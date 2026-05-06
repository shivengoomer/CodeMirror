export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  get url(): string {
    return this.baseUrl;
  }
}
