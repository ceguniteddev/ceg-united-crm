export async function getCaptchaTokenRegistrationOld(
  action: string
): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof grecaptcha === "undefined") {
      resolve(null);
      return;
    }
    grecaptcha.ready(async () => {
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
      if (!siteKey) {
        resolve(null);
        return;
      }
      const token = await grecaptcha.execute(siteKey, {
        action,
      });
      resolve(token);
    });
  });
}

export async function getCaptchaTokenRegistration(
  action: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const maxRetries = 10;
    let retryCount = 0;

    const attemptGetToken = () => {
      if (typeof grecaptcha === "undefined" || !grecaptcha.enterprise) {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(
            `Waiting for reCAPTCHA to load... (attempt ${retryCount}/${maxRetries})`
          );
          setTimeout(attemptGetToken, 300);
          return;
        }
        console.error("reCAPTCHA failed to load after maximum retries");
        resolve(null);
        return;
      }

      grecaptcha.enterprise.ready(async () => {
        const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
        if (!siteKey) {
          console.error("reCAPTCHA site key not found");
          resolve(null);
          return;
        }
        try {
          const token = await grecaptcha.enterprise.execute(siteKey, {
            action,
          });
          resolve(token);
        } catch (error) {
          console.error("Error executing reCAPTCHA:", error);
          resolve(null);
        }
      });
    };

    attemptGetToken();
  });
}
