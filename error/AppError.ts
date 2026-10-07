class AppError extends Error {
  statusCode?: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;

    Object.setPrototypeOf(this, new.target.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default AppError;
