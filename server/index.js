import express from "express";
import { createApp } from "./app.js";

const port = Number(process.env.PORT ?? 3000);

const app = createApp(express);
app.listen(port, "127.0.0.1", () => {
  console.log(`API listening on http://127.0.0.1:${port}`);
});
