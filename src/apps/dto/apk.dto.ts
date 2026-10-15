import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class UpsertApkDto {
  @IsString()
  @MinLength(1)
  slug: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  packageName: string;

  @IsOptional()
  @IsString()
  developer?: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  homeSection?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  apkUrl?: string;

  @IsOptional()
  @IsString()
  iconUrl?: string;

  @IsOptional()
  @IsString()
  short?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  requires?: string;

  @IsOptional()
  @IsString()
  accent?: string;

  @IsOptional()
  @IsString()
  letter?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class PatchApkDto {
  @IsOptional()
  @IsString()
  homeSection?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  kind?: string;
}
