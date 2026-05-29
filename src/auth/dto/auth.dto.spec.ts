import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto, LoginDto } from './auth.dto';

describe('RegisterDto 유효성 검사', () => {
  it('올바른 이메일·비밀번호(8자 이상) — 검증 오류 없음', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'valid@example.com',
      password: 'strongpw1',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('이메일 형식 위반 — @IsEmail 오류 반환', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'not-an-email',
      password: 'strongpw1',
    });
    const errors = await validate(dto);
    const emailErrors = errors.filter((e) => e.property === 'email');
    expect(emailErrors.length).toBeGreaterThan(0);
    expect(emailErrors[0].constraints).toHaveProperty('isEmail');
  });

  it('빈 이메일 — @IsEmail 오류 반환', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: '',
      password: 'strongpw1',
    });
    const errors = await validate(dto);
    const emailErrors = errors.filter((e) => e.property === 'email');
    expect(emailErrors.length).toBeGreaterThan(0);
  });

  it('비밀번호 7자(MinLength 미달) — @MinLength 오류 반환', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'valid@example.com',
      password: 'short1',
    });
    const errors = await validate(dto);
    const pwErrors = errors.filter((e) => e.property === 'password');
    expect(pwErrors.length).toBeGreaterThan(0);
    expect(pwErrors[0].constraints).toHaveProperty('minLength');
  });

  it('비밀번호 정확히 8자 — 검증 통과', async () => {
    const dto = plainToInstance(RegisterDto, {
      email: 'valid@example.com',
      password: '12345678',
    });
    const errors = await validate(dto);
    const pwErrors = errors.filter((e) => e.property === 'password');
    expect(pwErrors).toHaveLength(0);
  });
});

describe('LoginDto 유효성 검사', () => {
  it('올바른 이메일·비밀번호 — 검증 오류 없음', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'user@example.com',
      password: 'anypassword',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('이메일 형식 위반 — @IsEmail 오류 반환', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'bad-email',
      password: 'anypassword',
    });
    const errors = await validate(dto);
    const emailErrors = errors.filter((e) => e.property === 'email');
    expect(emailErrors.length).toBeGreaterThan(0);
    expect(emailErrors[0].constraints).toHaveProperty('isEmail');
  });

  it('빈 비밀번호 — @MinLength(1) 오류 반환', async () => {
    const dto = plainToInstance(LoginDto, {
      email: 'user@example.com',
      password: '',
    });
    const errors = await validate(dto);
    const pwErrors = errors.filter((e) => e.property === 'password');
    expect(pwErrors.length).toBeGreaterThan(0);
  });
});
