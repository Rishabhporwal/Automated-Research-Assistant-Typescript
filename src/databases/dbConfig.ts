import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ unique: true })
  username!: string;

  @Column()
  password!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

export class Database {
  private static instance: DataSource | null = null;

  static async getDataSource(): Promise<DataSource> {
    if (!Database.instance) {
      Database.instance = new DataSource({
        type: 'sqlite',
        database: './research_analyst.db',
        entities: [User],
        synchronize: true,
        logging: false,
      });

      try {
        await Database.instance.initialize();
        console.log('✅ Database initialized successfully');
      } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
      }
    }

    return Database.instance;
  }

  // ADD THIS METHOD - it was missing
  static async getUserRepository() {
    const dataSource = await Database.getDataSource();
    return dataSource.getRepository(User);
  }

  static async hashPassword(password: string): Promise<string> {
    const safePw = password.substring(0, 72); // bcrypt limit
    return await bcrypt.hash(safePw, 10);
  }

  static async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    const safePw = plainPassword.substring(0, 72);
    return await bcrypt.compare(safePw, hashedPassword);
  }

  static async close(): Promise<void> {
    if (Database.instance) {
      await Database.instance.destroy();
      Database.instance = null;
      console.log('✅ Database connection closed');
    }
  }
}