export type PasswordValidationResult = {
  valid: boolean;
  message?: string;
};

export type PasswordRequirement = {
  id: string;
  label: string;
  met: boolean;
};

export function getPasswordRequirements(password: string): PasswordRequirement[] {
  return [
    {
      id: "length",
      label: "6 to 15 characters",
      met: password.length >= 6 && password.length <= 15,
    },
    {
      id: "uppercase",
      label: "At least one uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      id: "lowercase",
      label: "At least one lowercase letter",
      met: /[a-z]/.test(password),
    },
    {
      id: "number",
      label: "At least one number",
      met: /[0-9]/.test(password),
    },
    {
      id: "special",
      label: "At least one special character",
      met: /[^A-Za-z0-9]/.test(password),
    },
  ];
}

export function validateAdminPassword(password: string): PasswordValidationResult {
  if (password.length < 6) {
    return {
      valid: false,
      message: "Password must be at least 6 characters.",
    };
  }

  if (password.length > 15) {
    return {
      valid: false,
      message: "Password must be 15 characters or fewer.",
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: "Password must include at least one uppercase letter.",
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: "Password must include at least one lowercase letter.",
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password must include at least one number.",
    };
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return {
      valid: false,
      message: "Password must include at least one special character.",
    };
  }

  return { valid: true };
}
