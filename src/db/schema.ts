import { pgTable, serial, text, integer, timestamp, boolean, primaryKey, pgEnum } from "drizzle-orm/pg-core";

// Rôles utilisateur
export const userRole = pgEnum("user_role", ["CLIENT", "FREELANCER"]);

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),          // <— NEW (nullable si OAuth)
  role: userRole("role").notNull().default("CLIENT"),
  bio: text("bio"),
  skills: text("skills"),
  rating: integer("rating"),
  companyName: text("company_name"),            // <— NEW (pour clients/boîtes)
  createdAt: timestamp("created_at").defaultNow(),
});

// Projets (créés par les clients)
export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  budget: integer("budget"),
  deadline: timestamp("deadline"),
  status: text("status").notNull().default("OPEN"), // OPEN, IN_PROGRESS, DONE, CANCELED
  createdAt: timestamp("created_at").defaultNow(),
});

// Offres (par les freelances sur un projet)
export const offers = pgTable("offers", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  freelancerId: integer("freelancer_id").notNull(),
  price: integer("price").notNull(),
  message: text("message"),
  status: text("status").notNull().default("PENDING"), // PENDING, ACCEPTED, REJECTED
  createdAt: timestamp("created_at").defaultNow(),
});

// Messages (chat lié à une offre sélectionnée)
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id").notNull(),
  senderId: integer("sender_id").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Paiements (placeholder: on branchera Stripe Connect plus tard)
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  offerId: integer("offer_id").notNull(),
  amount: integer("amount").notNull(),
  status: text("status").notNull().default("REQUIRES_PAYMENT"), // REQUIRES_PAYMENT, ESCROWED, RELEASED, REFUNDED
  stripeId: text("stripe_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
