import { Injectable } from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";

type SupabaseClientType = ReturnType<typeof createClient>;

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClientType;

  constructor() {
    this.client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );
  }

  getAdmin(): SupabaseClientType {
    return this.client;
  }

  /**
   * Cliente nuevo y desechable, sin persistir ni refrescar sesión. Para
   * operaciones que inician sesión como un usuario (p. ej. verificar su
   * contraseña actual) sin dejar esa sesión en el cliente admin compartido.
   */
  createEphemeralClient(): SupabaseClientType {
    return createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      },
    );
  }

  async uploadFile(
    bucket: string,
    path: string,
    file: Buffer,
    contentType: string,
  ): Promise<string> {
    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, file, { contentType, upsert: true });

    if (error) {
      throw new Error(
        `Failed to upload file to ${bucket}/${path}: ${error.message}`,
      );
    }

    return this.getPublicUrl(bucket, path);
  }

  getPublicUrl(bucket: string, path: string): string {
    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async deleteFile(bucket: string, path: string): Promise<void> {
    const { error } = await this.client.storage.from(bucket).remove([path]);
    if (error) {
      throw new Error(
        `Failed to delete file from ${bucket}/${path}: ${error.message}`,
      );
    }
  }
}
