// provider/fal/client.ts

export async function run(endpoint: string, params: any) {
    // 1. Submit request
    const response = await fetch(`https://queue.fal.run/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });
  
    const data = (await response.json()) as { request_id: string };
  
    if (!data.request_id) {
      throw new Error("No request_id found in response");
    }
  
    return await poll(data.request_id, endpoint);
  }
  
  async function poll(
    requestId: string,
    endpoint: string,
  ): Promise<{ status: string; result: any }> {
    const maxAttempts = 180; // 3 minutes
  
    for (let i = 0; i < maxAttempts; i++) {
      const response = await fetch(
        `https://queue.fal.run/${endpoint}/requests/${requestId}`,
        {
          headers: {
            Authorization: `Key ${process.env.FAL_KEY}`,
          },
        },
      );
  
      const data = (await response.json()) as { status: string; result: any };
  
      if (data.status === "completed") {
        return data.result;
      }
  
      if (data.status === "failed") {
        throw new Error(data.result.error || "Generation failed");
      }
  
      await sleep(1000); // Wait 1s between polls
    }
  
    throw new Error("Timeout waiting for fal response");
  }
  
  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  