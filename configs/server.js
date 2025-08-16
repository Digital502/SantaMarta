"use strict";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { dbConnection } from "./mongo.js";
import apiLimiter from "../src/middlewares/validate-limiter.js";
import { defaultUser } from "../src/helpers/user-fuctions.js";
import authRoutes from "../src/auth/auth.routes.js";
import userRoutes from "../src/user/user.routes.js";
import procesionRoutes from "../src/procesion/procesion.routes.js";
import turnoRoutes from "../src/turno/turno.router.js";
import devotoRoutes from "../src/devoto/devoto.routes.js";
import compraRoutes from "../src/compra/compra.routes.js";
import { verificarFechaProcesion } from "../src/helpers/verificarFechaProcesion.js";
import cron from "node-cron";

const app = express();

const middlewares = (app) => {
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(cors());
  app.use(helmet());
  app.use(morgan("dev"));
  app.use(apiLimiter);
};

const routes = (app) => {
  app.use("/santaMarta/api/v1/auth", authRoutes );
  app.use("/santaMarta/api/v1/user", userRoutes);
  app.use("/santaMarta/api/v1/procesion", procesionRoutes);
  app.use("/santaMarta/api/v1/turno", turnoRoutes);
  app.use("/santaMarta/api/v1/devoto", devotoRoutes);
  app.use("/santaMarta/api/v1/compra", compraRoutes);
};

const conectarDB = async () => {
  try {
    await dbConnection();
  } catch (err) {
    console.log(`Database connection failed: ${err}`);
    process.exit(1);
  }
};

export const initServer = () => {
    const app = express();
  try {
    middlewares(app);
    conectarDB();
    routes(app);
    defaultUser();
    cron.schedule("0 0 * * *", async () => {
      console.log("Verificando procesiones vencidas...");
      await verificarFechaProcesion();
    });
    app.listen(process.env.PORT, () => {
      console.log(`Server running on port ${process.env.PORT}`);
    });
  } catch (err) {
    console.log(`Server init failed: `, err);
  }
};