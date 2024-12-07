require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const cors = require('cors');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.post('/run', async (req, res) => {
  const { language, code } = req.body;

  const handleCppExecution = () => {
    const cppFile = 'temp.cpp';
    const executable = 'temp';

    // Step 1: Write the code to a temporary C++ file
    fs.writeFileSync(cppFile, code);

    // Step 2: Compile the C++ file using g++
    const compileProcess = spawn('g++', [cppFile, '-o', executable]);

    let compileErrors = '';

    compileProcess.stderr.on('data', (data) => {
      compileErrors += data.toString();
    });

    compileProcess.on('close', (compileCode) => {
      if (compileCode !== 0) {
        // Compilation failed; send errors
        return res.status(200).send({ output: `Compilation Error: ${compileErrors}` });
      }

      // Step 3: Execute the compiled file
      const runProcess = spawn(`./${executable}`);

      let stdoutData = '';
      let stderrData = '';

      runProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      runProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      runProcess.on('close', (runCode) => {
        // Cleanup temporary files
        fs.unlinkSync(cppFile);
        fs.unlinkSync(executable);

        if (stderrData) {
          return res.status(200).send({ output: `Runtime Error: ${stderrData}` });
        }

        res.send({ output: stdoutData || `Process exited with code ${runCode}` });
      });

      runProcess.on('error', (error) => {
        // Cleanup temporary files on error
        fs.unlinkSync(cppFile);
        fs.unlinkSync(executable);
        res.status(500).send({ output: `Execution Error: ${error.message}` });
      });
    });

    compileProcess.on('error', (error) => {
      res.status(500).send({ output: `Compilation Error: ${error.message}` });
    });
  };

  const commandMap = {
    javascript: () => {
      const process = spawn('node', ['-e', code]);

      let stdoutData = '';
      let stderrData = '';

      process.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      process.on('close', (code) => {
        if (stderrData) {
          return res.status(200).send({ output: `Error: ${stderrData}` });
        }
        res.send({ output: stdoutData || `Process exited with code ${code}` });
      });

      process.on('error', (error) => {
        res.status(500).send({ output: `Error: ${error.message}` });
      });
    },
    python: () => {
      const process = spawn('python', ['-c', code]);

      let stdoutData = '';
      let stderrData = '';

      process.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      process.on('close', (code) => {
        if (stderrData) {
          return res.status(200).send({ output: `Error: ${stderrData}` });
        }
        res.send({ output: stdoutData || `Process exited with code ${code}` });
      });

      process.on('error', (error) => {
        res.status(500).send({ output: `Error: ${error.message}` });
      });
    },
    cpp: handleCppExecution,
  };

  if (!commandMap[language]) {
    return res.status(200).send({ output: 'Unsupported language' });
  }

  commandMap[language]();
});

const PORT = process.env.PORT || 9000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
