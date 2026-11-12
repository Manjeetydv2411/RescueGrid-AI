export const responseFormatter = (
  _req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction
): void => {
  (res as any).success = function (data: unknown, statusCodeOrMessage: number | string = 200, message: string = "Success") {
    let code = 200;
    let msg = "Success";

    if (typeof statusCodeOrMessage === "number") {
      code = statusCodeOrMessage;
    } else if (typeof statusCodeOrMessage === "string") {
      msg = statusCodeOrMessage;
    }

    return res.status(code).json({
      success: true,
      message: msg,
      data,
    });
  };

  (res as any).created = function (data: unknown, message: string = "Created") {
    return res.status(201).json({
      success: true,
      message,
      data,
    });
  };

  (res as any).error = function (
    statusCode: number,
    message: string,
    details?: unknown
  ) {
    return res.status(statusCode).json({
      success: false,
      error: {
        message,
        details:
          process.env.NODE_ENV === "production" ? undefined : details,
      },
    });
  };

  next();
};

export default {
  responseFormatter,
};
