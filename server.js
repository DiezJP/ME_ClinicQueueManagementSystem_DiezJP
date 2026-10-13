const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const dataFile = path.join(__dirname, "data.json");

app.use(express.json());

function readPatients() {
  const data = JSON.parse(fs.readFileSync(dataFile, "utf8"));
  if (!data || !Array.isArray(data.patients)) {
    throw new Error("data.json must contain a patients array.");
  }

  for (const patient of data.patients) {
    if (
      !patient ||
      !Number.isSafeInteger(patient.id) ||
      patient.id < 1 ||
      !Number.isSafeInteger(patient.queue_number) ||
      patient.queue_number < 1 ||
      typeof patient.patient_name !== "string" ||
      typeof patient.service !== "string" ||
      typeof patient.priority !== "string"
    ) {
      throw new Error("data.json contains an invalid patient record.");
    }
  }

  return data.patients;
}

function writePatients(patients) {
  fs.writeFileSync(dataFile, `${JSON.stringify({ patients }, null, 2)}\n`);
}

function parsePatientId(value) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

app.get("/api/patients", (req, res) => {
  res.json(readPatients());
});

app.get("/api/patients/:id", (req, res) => {
  const id = parsePatientId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "Patient ID must be a positive integer." });
  }

  const patient = readPatients().find((record) => record.id === id);
  if (!patient) {
    return res.status(404).json({ error: "Patient not found." });
  }

  res.json(patient);
});

app.post("/api/patients", (req, res) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return res.status(400).json({ error: "A JSON object is required." });
  }

  const patientName = typeof body.patient_name === "string" ? body.patient_name.trim() : "";
  const service = typeof body.service === "string" ? body.service.trim() : "";
  const priority = typeof body.priority === "string" ? body.priority.trim() : "";

  if (!patientName || !service || !priority) {
    return res.status(400).json({
      error: "Patient name, service, and priority are required.",
    });
  }
  if (patientName.length > 100 || service.length > 100) {
    return res.status(400).json({
      error: "Patient name and service must be 100 characters or fewer.",
    });
  }
  if (!["Normal", "High", "Urgent"].includes(priority)) {
    return res.status(400).json({ error: "Priority must be Normal, High, or Urgent." });
  }

  const patients = readPatients();
  const id = Math.max(0, ...patients.map((patient) => patient.id)) + 1;
  const queue_number = Math.max(0, ...patients.map((patient) => patient.queue_number)) + 1;
  const patient = { id, patient_name: patientName, service, priority, queue_number };

  patients.push(patient);
  writePatients(patients);
  res.status(201).json(patient);
});

app.delete("/api/patients/:id", (req, res) => {
  const id = parsePatientId(req.params.id);
  if (id === null) {
    return res.status(400).json({ error: "Patient ID must be a positive integer." });
  }

  const patients = readPatients();
  const index = patients.findIndex((patient) => patient.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "Patient not found." });
  }

  const [deletedPatient] = patients.splice(index, 1);
  writePatients(patients);
  res.json(deletedPatient);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found." });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);

  const status = error.status && error.status >= 400 && error.status < 500
    ? error.status
    : 500;
  const message = status === 500 ? "An unexpected server error occurred." : error.message;
  if (status === 500) console.error(error);
  res.status(status).json({ error: message });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Clinic Queue is running at http://localhost:${port}`));
