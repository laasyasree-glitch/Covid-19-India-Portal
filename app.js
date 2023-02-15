const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

let db = null;

const initializeDBServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
  app.listen(3008, () => console.log("Sever started at 3008"));
};
initializeDBServer();
module.exports = app;

app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  const selectUserQuery = `Select * from user where username='${username}' `;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const validatePassword = await bcrypt.compare(password, dbUser.password);

    if (validatePassword) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  }
});

const authenticateToken = (req, res, next) => {
  let jwtToken;
  const authHeader = req.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    res.status(401);
    res.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        res.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.get("/states/", authenticateToken, async (req, res) => {
  const getQuery = `
                SELECT * FROM STATE ORDER BY STATE_ID
                `;
  const statesArray = await db.all(getQuery);
  res.send(statesArray);
});

app.get("/states/:stateId", authenticateToken, async (req, res) => {
  const { stateId } = req.params;
  const getQuery = `
        SELECT *  FROM STATE WHERE STATE_ID=${stateId}
    `;
  const state = await db.get(getQuery);
  res.send(state);
});

app.post("/districts/", authenticateToken, async (req, res) => {
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  const postQuery = `
    INSERT INTO DISTRICT(district_name, state_id, cases, cured, active, deaths)
    VALUES( '${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths})
    `;
  await db.run(postQuery);
  res.send("District Successfully Added");
});

app.get("/districts/:districtId", authenticateToken, async (req, res) => {
  const { districtId } = req.params;
  const getQuery = `
        SELECT *  FROM DISTRICT WHERE DISTRICT_ID=${districtId}
    `;
  const district = await db.get(getQuery);
  res.send(district);
});

app.delete("/districts/:districtId", authenticateToken, async (req, res) => {
  const { districtId } = req.params;
  const getQuery = `
        DELETE FROM DISTRICT WHERE DISTRICT_ID=${districtId}
    `;
  await db.run(getQuery);
  res.send("District Removed");
});

app.put("/districts/:districtId", authenticateToken, async (req, res) => {
  const { districtId } = req.params;
  const { districtName, stateId, cases, cured, active, deaths } = req.body;
  const putQuery = `
  UPDATE DISTRICT SET
    district_name = '${districtName}',
    state_id= ${stateId},
    cases=${cases},
    active=${active},
    deaths=${deaths} where district_id=${districtId}
    `;
  await db.run(putQuery);
  res.send("District Details Updated");
});

app.get("/states/:stateId/stats/", authenticateToken, async (req, res) => {
  const { stateId } = req.params;
  const statsQuery = `
        select sum(cases) as totalCases,
        sum(cured) as totalCured,
        sum(active) as totalActive,
        sum(deaths) as totalDeaths
        from 
        DISTRICT WHERE STATE_ID=${stateId}
    `;
  const stats = await db.get(statsQuery);
  res.send(stats);
});

module.exports = app;
