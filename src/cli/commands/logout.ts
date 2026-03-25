/**
 * vargai logout — clear saved credentials
 */

import { defineCommand } from "citty";
import {
  clearCredentials,
  getCredentials,
  getCredentialsPath,
} from "../credentials";

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

export const logoutCmd = defineCommand({
  meta: {
    name: "logout",
    description: "sign out and remove saved API key",
  },
  async run() {
    const creds = getCredentials();

    if (!creds) {
      console.log(
        `\n${COLORS.dim}Not logged in. No credentials to remove.${COLORS.reset}\n`,
      );
      return;
    }

    const removed = clearCredentials();

    if (removed) {
      console.log();
      console.log(
        `${COLORS.green} ✓${COLORS.reset}  Logged out. Credentials removed from ${COLORS.dim}${getCredentialsPath()}${COLORS.reset}`,
      );
      console.log(
        `${COLORS.dim}   Previously logged in as ${creds.email}${COLORS.reset}`,
      );
      console.log();
      console.log(
        `${COLORS.dim}To log in again: ${COLORS.reset}${COLORS.cyan}vargai login${COLORS.reset}`,
      );
      console.log();
    } else {
      console.log(
        `\n${COLORS.yellow} !${COLORS.reset}  No credentials file found.\n`,
      );
    }
  },
});
