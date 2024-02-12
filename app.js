const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const http = require("http");
const WebSocket = require('ws');

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection
mongoose.connect("mongodb+srv://zarrougabdelhafidh:mynameishafa@cluster0.5mwcivt.mongodb.net/?retryWrites=true&w=majority", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;

const jwt = require("jsonwebtoken");

// Clé secrète pour la création et la vérification des JWT
const secretKey = process.env.SECRET_KEY || "votreclésecrete"; // Utilisation d'unevariable d'environnement

// Messages constants
const ERROR_MESSAGE = "L'authentification a échoué";
const SUCCESS_MESSAGE = "L'authentification a réussi";

db.on("error", () => {
  console.log("Erreur de connexion à MongoDB :");
});
db.once("open", () => {
  console.log("Connecté à MongoDB");
});

// Tasks Model
const TasksModel = require("./Models/Tasks");

// Swagger configuration options
const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Tasks API",
      version: "1.0.0",
      description: "API for managing tasks",
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
  },
  apis: ["./Models/Tasks.js"], // Path to the Tasks model file (assuming it contains annotations for Swagger)
};

const specs = swaggerJsdoc(options);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));

// Create HTTP server
const server = http.createServer(app);

// WebSocket logic
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("New WebSocket client connected");

  // Example: Broadcast task updates to all clients
  ws.on("message", async (message) => {
    console.log("Received message from client:", message);

    // Echo the message back to the client
    ws.send(`Echo: ${message}`);
  });
});

// Routes
app.get("/tasks", async (req, res) => {
  //Vérification du JWT dans l'en-tête Authorization
  const token = req.headers.authorization;
  if (!token) {
    res.status(401).json({ message: "Aucun token fourni" });
    return;
  }
  jwt.verify(token, secretKey, async (err, decoded) => {
    if (err) {
      res.status(401).json({ message: "Token non valide" });
    } else {
      try {
        const liste = await TasksModel.find({}).exec();
        return res.status(200).json({ success: true, liste });
      } catch (err) {
        console.error(err);
        return res.status(500).json({
          success: false,
          message: "Erreur interne du serveur.",
        });
      }
    }
  });
});

app.get("/tasks/:id", async (req, res) => {
  //Vérification du JWT dans l'en-tête Authorization
  const token = req.headers.authorization;
  if (!token) {
    res.status(401).json({ message: "Aucun token fourni" });
    return;
  }
  jwt.verify(token, secretKey, async (err, decoded) => {
    if (err) {
      res.status(401).json({ message: "Token non valide" });
    } else {
      try {
        const taskId = req.params.id;
        const task = await TasksModel.findById(taskId).exec();
        if (!task) {
          return res.status(404).json({
            success: false,
            message: "Task not found",
          });
        }
        return res.status(200).json({ success: true, task });
      } catch (err) {
        console.error(err);
        return res.status(500).json({
          success: false,
          message: "Erreur interne du serveur.",
        });
      }
    }
  });
});

app.post("/tasks", async (req, res) => {
  //Vérification du JWT dans l'en-tête Authorization
  const token = req.headers.authorization;
  if (!token) {
    res.status(401).json({ message: "Aucun token fourni" });
    return;
  }
  jwt.verify(token, secretKey, async (err, decoded) => {
    if (err) {
      res.status(401).json({ message: "Token non valide" });
    } else {
      try {
        const { titre, description, état } = req.body;
        if (!titre || !description || !état) {
          return res
            .status(400)
            .json({ message: "Le titre, la description et l'état sont requis." });
        }
        const task = new TasksModel({ titre, description, état });
        const savedTask = await task.save();
        // Emit event to notify clients about the new task
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ action: "taskAdded", task: savedTask }));
          }
        });
        return res
          .status(200)
          .json({ message: "Tâche ajoutée avec succès.", task: savedTask });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Erreur interne du serveur." });
      }
    }
  });
});

app.put("/tasks/:id", async (req, res) => {
  //Vérification du JWT dans l'en-tête Authorization
  const token = req.headers.authorization;
  if (!token) {
    res.status(401).json({ message: "Aucun token fourni" });
    return;
  }
  jwt.verify(token, secretKey, async (err, decoded) => {
    if (err) {
      res.status(401).json({ message: "Token non valide" });
    } else {
      try {
        const taskId = req.params.id;
        const { titre, description, état } = req.body;
        const updatedTask = await TasksModel.findByIdAndUpdate(
          taskId,
          { titre, description, état },
          { new: true }
        );
        if (!updatedTask) {
          return res.status(404).json({
            success: false,
            message: "Task not found",
          });
        }
        // Emit event to notify clients about the updated task
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ action: "taskUpdated", task: updatedTask }));
          }
        });
        return res.status(200).json({
          success: true,
          message: "Task updated successfully",
          task: updatedTask,
        });
      } catch (err) {
        console.error(err);
        return res.status(500).json({
          success: false,
          message: "Internal Server Error",
        });
      }
    }
  });
});

app.delete("/tasks/:id", async (req, res) => {
  //Vérification du JWT dans l'en-tête Authorization
  const token = req.headers.authorization;
  if (!token) {
    res.status(401).json({ message: "Aucun token fourni" });
    return;
  }
  jwt.verify(token, secretKey, async (err, decoded) => {
    if (err) {
      res.status(401).json({ message: "Token non valide" });
    } else {
      try {
        const taskId = req.params.id;
        const deletedTask = await TasksModel.findByIdAndDelete(taskId);
        if (!deletedTask) {
          return res.status(404).json({
            success: false,
            message: "Task not found",
          });
        }
        // Emit event to notify clients about the deleted task
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ action: "taskDeleted", taskId }));
          }
        });
        return res.status(200).json({
          success: true,
          message: "Task deleted successfully",
        });
      } catch (err) {
        console.error(err);
        return res.status(500).json({
          success: false,
          message: "Internal Server Error",
        });
      }
    }
  });
});

// Middleware pour gérer l'authentification
app.post("/login", (req, res) => {
  try {
    const { username, password } = req.body;
    // Validation des champs requis
    if (!username || !password) {
      throw new Error('Les champs "username" et "password" sont requis.');
    }
    // Dans un véritable cas d'utilisation, vous vérifieriez les informations d'authentification ici
    // Si l'authentification réussit, vous pouvez générer un JWT
    if (username === "zarroug" && password === "hafa") {
      const token = jwt.sign({ username }, secretKey, { expiresIn: "1h" });
      res.json({ token, message: SUCCESS_MESSAGE });
    } else {
      res.status(401).json({ message: ERROR_MESSAGE });
    }
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: "Erreur interne du serveur." });
  }
});

// Server listening
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`the server is listening on ${PORT}`);
});
