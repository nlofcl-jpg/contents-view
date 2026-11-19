import dotenv from "dotenv";

if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.local", quiet: true });
}
dotenv.config({ quiet: true });
