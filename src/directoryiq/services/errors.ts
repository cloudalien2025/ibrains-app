export class DirectoryIqServiceError extends Error {
  status: number;
  code: string;
  reqId: string;
  details?: string;

  constructor(input: { message: string; status: number; code: string; reqId: string; details?: string }) {
    super(input.message);
    this.status = input.status;
    this.code = input.code;
    this.reqId = input.reqId;
    this.details = input.details;
  }
}
