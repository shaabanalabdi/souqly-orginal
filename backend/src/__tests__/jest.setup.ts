beforeAll(() => {
    process.env.JWT_SECRET = 'test-access-secret';
    process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
});

afterEach(() => {
    jest.restoreAllMocks();
});
