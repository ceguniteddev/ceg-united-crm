"use server";
import AppError from "@/error/AppError";
import { RecaptchaEnterpriseServiceClient } from "@google-cloud/recaptcha-enterprise";

export async function verifyCaptchaToken(token: string) {
  const secretKey = process.env.RECAPTCHA_SECRET_KEY;
  if (!secretKey) {
    throw new AppError("No secret key found");
  }

  const url = new URL("https://www.google.com/recaptcha/api/siteverify");
  url.searchParams.append("secret", secretKey);
  url.searchParams.append("response", token);

  const res = await fetch(url, { method: "POST" });
  const captchaData: CaptchaData = await res.json();

  if (!res.ok) return null;
  return captchaData;
}

let recaptchaClient: RecaptchaEnterpriseServiceClient | null = null;

function getClient(): RecaptchaEnterpriseServiceClient {
  if (!recaptchaClient) {
    // This will be executed only once per server instance.
    recaptchaClient = new RecaptchaEnterpriseServiceClient();
  }
  return recaptchaClient;
}

export async function createEnterpriseAssessment(
  token: string,
  recaptchaAction: string
): Promise<{ score: number }> {
  const projectID = process.env.FIREBASE_PROJECT_ID;
  const recaptchaKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const scoreThreshold = 0.5;

  if (!projectID || !recaptchaKey) {
    throw new AppError(
      "Missing Google Cloud or reCAPTCHA Enterprise configuration."
    );
  }

  const client = getClient();
  const projectPath = client.projectPath(projectID);

  const request = {
    assessment: {
      event: {
        token: token,
        siteKey: recaptchaKey,
      },
    },
    parent: projectPath,
  };

  const [response] = await client.createAssessment(request);

  // 1. Check if the token is valid.
  if (!response.tokenProperties?.valid) {
    const invalidReason =
      response.tokenProperties?.invalidReason || "NO_REASON_GIVEN";
    throw new AppError(`The reCAPTCHA token was invalid: ${invalidReason}`);
  }

  // 2. Check if the action matches what we expect.
  if (response.tokenProperties.action !== recaptchaAction) {
    throw new AppError("reCAPTCHA action mismatch. Possible bot activity.");
  }

  const score = response.riskAnalysis?.score;
  if (score === null || score === undefined) {
    throw new AppError("Could not retrieve reCAPTCHA score.");
  }

  // 3. Check if the risk score is above our threshold.
  if (score < scoreThreshold) {
    console.warn(`Low reCAPTCHA score: ${score}. Blocking request.`);
    throw new AppError("Captcha validation failed. Please try again.");
  }

  return { score };
}

type CaptchaData =
  | {
      success: true;
      challenge_ts: string;
      hostname: string;
      score: number;
      action: string;
    }
  | {
      success: false;
      "error-codes": ErrorCodes[];
    };

type ErrorCodes =
  | "missing-input-secret"
  | "invalid-input-secret"
  | "missing-input-response"
  | "invalid-input-response"
  | "bad-request"
  | "timeout-or-duplicate";
