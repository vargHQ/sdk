import { describe, expect, mock, test } from "bun:test";
import { limitedRetryUpload, r2UploadLimiter, retryR2Upload } from "./retry";

// Use minimal delays for tests
const fastOpts = { maxRetries: 3, baseDelay: 1 };

// ─── Error factories ─────────────────────────────────────────────────────────

/** Simulates an AWS SDK v3 ServiceException with $metadata */
function awsError(
  name: string,
  message: string,
  httpStatusCode?: number,
): Error & { $metadata?: { httpStatusCode: number } } {
  const err = new Error(message) as Error & {
    $metadata?: { httpStatusCode: number };
  };
  err.name = name;
  if (httpStatusCode !== undefined) {
    err.$metadata = { httpStatusCode };
  }
  return err;
}

/** Error with a `code` property (Node.js-style) */
function codeError(
  code: string,
  message = "connection failed",
): Error & { code: string } {
  const err = new Error(message) as Error & { code: string };
  err.code = code;
  return err;
}

// ─── isRetryable (tested indirectly through retryR2Upload) ───────────────────

describe("retryR2Upload", () => {
  describe("retries on retryable errors", () => {
    test("retries on error.message containing 'concurrent request rate'", async () => {
      let calls = 0;
      const result = await retryR2Upload(async () => {
        calls++;
        if (calls === 1)
          throw new Error(
            "Reduce your concurrent request rate for the same object.",
          );
        return "ok";
      }, fastOpts);

      expect(result).toBe("ok");
      expect(calls).toBe(2);
    });

    test("retries on error.name = SlowDown (AWS SDK v3 pattern)", async () => {
      let calls = 0;
      const result = await retryR2Upload(async () => {
        calls++;
        if (calls === 1)
          throw awsError("SlowDown", "Please reduce request rate.");
        return "ok";
      }, fastOpts);

      expect(result).toBe("ok");
      expect(calls).toBe(2);
    });

    test("retries on error.name = ServiceUnavailable", async () => {
      let calls = 0;
      const result = await retryR2Upload(async () => {
        calls++;
        if (calls === 1)
          throw awsError(
            "ServiceUnavailable",
            "Service is temporarily unavailable",
          );
        return "ok";
      }, fastOpts);

      expect(result).toBe("ok");
      expect(calls).toBe(2);
    });

    test("retries on $metadata.httpStatusCode = 429", async () => {
      let calls = 0;
      const result = await retryR2Upload(async () => {
        calls++;
        if (calls === 1) throw awsError("UnknownError", "rate limited", 429);
        return "ok";
      }, fastOpts);

      expect(result).toBe("ok");
      expect(calls).toBe(2);
    });

    test("retries on $metadata.httpStatusCode = 500", async () => {
      let calls = 0;
      const result = await retryR2Upload(async () => {
        calls++;
        if (calls === 1) throw awsError("InternalServerError", "oops", 500);
        return "ok";
      }, fastOpts);

      expect(result).toBe("ok");
      expect(calls).toBe(2);
    });

    test("retries on $metadata.httpStatusCode = 503", async () => {
      let calls = 0;
      const result = await retryR2Upload(async () => {
        calls++;
        if (calls === 1) throw awsError("Unavailable", "try again", 503);
        return "ok";
      }, fastOpts);

      expect(result).toBe("ok");
      expect(calls).toBe(2);
    });

    test("retries on error.code = ECONNRESET", async () => {
      let calls = 0;
      const result = await retryR2Upload(async () => {
        calls++;
        if (calls === 1) throw codeError("ECONNRESET");
        return "ok";
      }, fastOpts);

      expect(result).toBe("ok");
      expect(calls).toBe(2);
    });

    test("retries on error.code = ETIMEDOUT", async () => {
      let calls = 0;
      const result = await retryR2Upload(async () => {
        calls++;
        if (calls === 1) throw codeError("ETIMEDOUT");
        return "ok";
      }, fastOpts);

      expect(result).toBe("ok");
      expect(calls).toBe(2);
    });

    test("retries on 'socket hang up' in message", async () => {
      let calls = 0;
      const result = await retryR2Upload(async () => {
        calls++;
        if (calls === 1) throw new Error("socket hang up");
        return "ok";
      }, fastOpts);

      expect(result).toBe("ok");
      expect(calls).toBe(2);
    });
  });

  describe("does NOT retry on non-retryable errors", () => {
    test("throws immediately on AccessDenied", async () => {
      let calls = 0;
      await expect(
        retryR2Upload(async () => {
          calls++;
          throw awsError("AccessDenied", "Access Denied", 403);
        }, fastOpts),
      ).rejects.toThrow("Access Denied");

      expect(calls).toBe(1);
    });

    test("throws immediately on NoSuchBucket", async () => {
      let calls = 0;
      await expect(
        retryR2Upload(async () => {
          calls++;
          throw awsError(
            "NoSuchBucket",
            "The specified bucket does not exist",
            404,
          );
        }, fastOpts),
      ).rejects.toThrow("The specified bucket does not exist");

      expect(calls).toBe(1);
    });

    test("throws immediately on generic Error", async () => {
      let calls = 0;
      await expect(
        retryR2Upload(async () => {
          calls++;
          throw new Error("something completely unrelated");
        }, fastOpts),
      ).rejects.toThrow("something completely unrelated");

      expect(calls).toBe(1);
    });

    test("does not retry primitive/null errors", async () => {
      let calls = 0;
      await expect(
        retryR2Upload(async () => {
          calls++;
          throw null;
        }, fastOpts),
      ).rejects.toBeNull();

      expect(calls).toBe(1);
    });
  });

  describe("retry limits and exhaustion", () => {
    test("retries up to maxRetries times then throws", async () => {
      let calls = 0;
      await expect(
        retryR2Upload(
          async () => {
            calls++;
            throw new Error("SlowDown");
          },
          { maxRetries: 2, baseDelay: 1 },
        ),
      ).rejects.toThrow("SlowDown");

      // 1 initial + 2 retries = 3 total calls
      expect(calls).toBe(3);
    });

    test("maxRetries: 0 means no retries (single attempt)", async () => {
      let calls = 0;
      await expect(
        retryR2Upload(
          async () => {
            calls++;
            throw new Error("SlowDown");
          },
          { maxRetries: 0, baseDelay: 1 },
        ),
      ).rejects.toThrow("SlowDown");

      expect(calls).toBe(1);
    });

    test("succeeds on the last retry attempt", async () => {
      let calls = 0;
      const result = await retryR2Upload(
        async () => {
          calls++;
          if (calls <= 3) throw new Error("SlowDown");
          return "finally";
        },
        { maxRetries: 3, baseDelay: 1 },
      );

      expect(result).toBe("finally");
      expect(calls).toBe(4); // 1 initial + 3 retries
    });
  });

  describe("returns value on success", () => {
    test("returns value on first attempt", async () => {
      const result = await retryR2Upload(async () => "immediate", fastOpts);
      expect(result).toBe("immediate");
    });

    test("returns complex objects", async () => {
      const obj = { url: "https://s3.varg.ai/test.mp4", key: "test.mp4" };
      const result = await retryR2Upload(async () => obj, fastOpts);
      expect(result).toEqual(obj);
    });
  });

  describe("input validation", () => {
    test("rejects negative maxRetries", async () => {
      await expect(
        retryR2Upload(async () => "ok", { maxRetries: -1, baseDelay: 1 }),
      ).rejects.toThrow("maxRetries");
    });

    test("rejects NaN maxRetries", async () => {
      await expect(
        retryR2Upload(async () => "ok", { maxRetries: NaN, baseDelay: 1 }),
      ).rejects.toThrow("maxRetries");
    });

    test("rejects float maxRetries", async () => {
      await expect(
        retryR2Upload(async () => "ok", { maxRetries: 2.5, baseDelay: 1 }),
      ).rejects.toThrow("maxRetries");
    });

    test("rejects negative baseDelay", async () => {
      await expect(
        retryR2Upload(async () => "ok", { maxRetries: 1, baseDelay: -100 }),
      ).rejects.toThrow("baseDelay");
    });

    test("rejects Infinity baseDelay", async () => {
      await expect(
        retryR2Upload(async () => "ok", {
          maxRetries: 1,
          baseDelay: Number.POSITIVE_INFINITY,
        }),
      ).rejects.toThrow("baseDelay");
    });

    test("accepts zero baseDelay", async () => {
      const result = await retryR2Upload(async () => "ok", {
        maxRetries: 0,
        baseDelay: 0,
      });
      expect(result).toBe("ok");
    });
  });
});

// ─── limitedRetryUpload ──────────────────────────────────────────────────────

describe("limitedRetryUpload", () => {
  test("runs upload through concurrency limiter and retry", async () => {
    const result = await limitedRetryUpload(async () => "uploaded");
    expect(result).toBe("uploaded");
  });

  test("retries within the limiter on retryable errors", async () => {
    let calls = 0;
    const result = await limitedRetryUpload(
      async () => {
        calls++;
        if (calls === 1) throw new Error("SlowDown");
        return "ok";
      },
      { maxRetries: 2, baseDelay: 1 },
    );

    expect(result).toBe("ok");
    expect(calls).toBe(2);
  });

  test("respects concurrency limit", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const tasks = Array.from({ length: 20 }, () =>
      limitedRetryUpload(
        async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((r) => setTimeout(r, 10));
          concurrent--;
          return "done";
        },
        { maxRetries: 0, baseDelay: 0 },
      ),
    );

    await Promise.all(tasks);

    // r2UploadLimiter is set to 10
    expect(maxConcurrent).toBeLessThanOrEqual(10);
    expect(maxConcurrent).toBeGreaterThan(1); // should actually parallelize
  });
});

// ─── r2UploadLimiter ─────────────────────────────────────────────────────────

describe("r2UploadLimiter", () => {
  test("is a p-limit instance with concurrency 10", () => {
    // p-limit exposes activeCount and pendingCount
    expect(typeof r2UploadLimiter).toBe("function");
    expect(r2UploadLimiter.activeCount).toBe(0);
    expect(r2UploadLimiter.pendingCount).toBe(0);
  });
});
