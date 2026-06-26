const baselineFileSha = process.env.BASELINE_TOKEN_FILE_SHA;
const latestFileSha = process.env.LATEST_TOKEN_FILE_SHA;

if (!baselineFileSha || !latestFileSha) {
  console.log(
    "Skipping stale token PR check: BASELINE_TOKEN_FILE_SHA and LATEST_TOKEN_FILE_SHA are not both set.",
  );
  process.exit(0);
}

if (baselineFileSha !== latestFileSha) {
  throw new Error(
    [
      "Token file changed after the plugin baseline was created.",
      `Baseline file SHA: ${baselineFileSha}`,
      `Latest file SHA: ${latestFileSha}`,
      "Regenerate the review request from the latest repository state.",
    ].join("\n"),
  );
}

console.log("Stale token PR check passed.");
