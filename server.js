const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to AKAI Backend",
    status: "Running"
  });
});

app.post("/chat", (req, res) => {
  const { message } = req.body;

  res.json({
    reply: "AKAI received: " + message
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`AKAI Backend running on port ${PORT}`);
});
