import express, { Request, Response, NextFunction } from "express";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";

const app = express();

// Middleware setup
app.use(
  helmet({
    contentSecurityPolicy: false, // Adjust CSP as needed
    frameguard: { action: "deny" },
    noSniff: true,
    xssFilter: true,
    // Add other Helmet configurations here
  })
);
app.use(morgan("common"));
app.use(express.json());

// Routes setup
app.use("/api", routes); // Prefix all routes with /api

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
