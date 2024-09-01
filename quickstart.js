import { Octokit } from "octokit";
import readlineSync from "readline-sync";
import fs from "fs-extra";
import simpleGit from "simple-git";
// import sodium from "libsodium-wrappers";
import crypto from "crypto";

import _sodium from "libsodium-wrappers";
await _sodium.ready;
const sodium = _sodium;

const extractUsernameAndPassword = (string) => {
  const usernameAndPassword = string.split("@")[0].split("postgresql://")[1];
  const username = usernameAndPassword.split(":")[0];
  const password = usernameAndPassword.split(":")[1];
  return { username, password };
};

async function main() {
  // Step 1: Remove existing .git folder
  await fs.remove(".git");
  console.log(".git folder removed.");

  // Step 2: Initialize a new Git repository.
  const git = simpleGit();
  await git.init();
  console.log("Initialized a new git repository.");
  let repoName;
  let username;
  username = readlineSync.question("Enter your GitHub username: ");

  // Step 3: Gather GitHub Authentication Token
  const githubToken = readlineSync.question(
    "Enter your GitHub authentication token: ",
    {
      hideEchoBack: true,
    }
  );

  // Step 4: Initialize Octokit
  const octokit = new Octokit({
    auth: githubToken,
  });

  // Step 5: Check for existing GitHub repository
  const repoExists = readlineSync.keyInYN(
    "Do you have an existing GitHub repository? "
  );

  if (repoExists) {
    repoName = readlineSync.question(
      "Enter the name of the existing GitHub repository: "
    );
  } else {
    repoName = readlineSync.question(
      "Enter the name for the new GitHub repository: "
    );

    console.log("Creating your new repository...");
    await octokit.request("POST /user/repos", {
      name: repoName,
      description: "Quickstart",
      homepage: "https://github.com",
      private: false,
      is_template: true,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    console.log("Github Repo created");
  }

  // Step 7: Add remote and push to GitHub

  await git.add(".");
  await git.commit("Initial commit");
  await git.branch(["-M", "main"]);

  // Step 10: Create GitHub secrets
  const repo = repoName;

  //Get repo key
  const keyResponse = await octokit.request(
    "GET /repos/{owner}/{repo}/actions/secrets/public-key",
    {
      owner: username,
      repo: repo,
      headers: {
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  const key = keyResponse.data.key;
  const key_id = keyResponse.data.key_id;

  const processVariables = async (variables_, type) => {
    let variableBucket = [];
    variables_.forEach(({ variable, _ }) => {
      const value = readlineSync.question(`Enter value for ${variable}: `);
      const newPair = { variable: `${variable}`, value: `${value}` };
      variableBucket.push(newPair);
      envContent += `${variable}=${value}\n`;
    });

    if (type == 1) {
      const { username, password } = extractUsernameAndPassword(
        variableBucket[0].value
      );
      variableBucket.push({ variable: "PG_PASSWORD", value: password });
      variableBucket.push({ variable: "PG_USERNAME", value: username });
    }

    if (type == 2) {
      const AUTH0_SECRET = crypto.randomBytes(32).toString("hex");
      variableBucket.push({ variable: "AUTH0_SECRET", value: AUTH0_SECRET });
      variableBucket.push({
        variable: "AUTH0_BASE_URL",
        value: "http:localhost:3000",
      });
      variableBucket.push({
        variable: "AUTH0_ISSUER_BASE_URL",
        value: `https://${variableBucket[0].value}`,
      });
      envContent += `AUTH0_ISSUER_BASE_URL=${AUTH0_SECRET}\n`;
    }

    console.log("Setting Git Secrets...");

    for (const variable of variableBucket) {
      const encrypted_secret = await encryptSecret(variable.value);
      await octokit.request(
        "PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}",
        {
          owner: username,
          repo: repo,
          secret_name: variable.variable,
          encrypted_value: encrypted_secret,
          key_id: key_id,
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );
    }
  };

  const cicdVariables = [
    { variable: "DATABASE_URL", value: "" },
    { variable: "DIRECT_DATABASE_URL", value: "" },
    { variable: "VERCEL_TOKEN", value: "" },
    { variable: "NEON_PROJECT_ID", value: "" },
    { variable: "NEON_API_KEY", value: "" },
    { variable: "NEON_DATABASE_NAME", value: "" },
  ];

  const hasuraVariables = [{ variable: "HASURA_ADMIN_SECRET", value: "" }];

  const auth0Variables = [
    { variable: "AUTH0_DOMAIN", value: "" },
    { variable: "AUTH0_CLIENT_SECRET", value: "" },
    { variable: "AUTH0_CLIENT_ID", value: "" },
  ];

  let envContent = "";

  const cicd = readlineSync.keyInYN(
    "Do you want to set up CI/CD with NEON Branching?"
  );

  if (cicd) {
    await processVariables(cicdVariables, 1);
  }

  const hasura = readlineSync.keyInYN("Do you want to set up Hasura?");

  if (hasura) {
    await processVariables(hasuraVariables);
  }

  const auth0 = readlineSync.keyInYN("Do you want to set up AUTH0?");

  if (auth0) {
    await processVariables(auth0Variables, 2);
  }

  fs.writeFileSync(".env", envContent);
  console.log(".env file created.");

  // Step 9: Add .env to .gitignore
  fs.appendFileSync(".gitignore", "\n.env");
  console.log(".env added to .gitignore.");

  async function encryptSecret(secret) {
    try {
      // Wait for libsodium to be ready
      await sodium.ready;

      // Convert the secret and key to a Uint8Array
      const binkey = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
      const binsec = sodium.from_string(secret);

      // Encrypt the secret using libsodium
      const encBytes = sodium.crypto_box_seal(binsec, binkey);

      // Convert the encrypted Uint8Array to Base64
      const output = sodium.to_base64(
        encBytes,
        sodium.base64_variants.ORIGINAL
      );
      return output;
    } catch (error) {
      console.error("Error encrypting secret:", error);
    }
  }

  await git.addRemote(
    "origin",
    `https://github.com/${username}/${repoName}.git`
  );
  await git.push("origin", "main", { "--force": null });
  console.log("Code pushed to GitHub.");
  console.log("Project setup completed successfully.");
}

main().catch(console.error);
