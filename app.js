const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
app.use(express.json());
const path = require("path");
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const initializeDBAndServer = async () => {
  try {
    db = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("server listening at port: 3000");
    });
  } catch (e) {
    console.log(e.message);
    process.exitCode(1);
  }
};

initializeDBAndServer();

//tables: state, district, user,
//state_id, state_name, population
//district_id, district_name, state_id, cases, cured, active, deaths

app.post("/register", async (request, response) => {
  //console.log(request.body);
  const { username, name, password, gender, location } = request.body;
  //console.log(username, name, password, gender, location);
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `
  select * from user
  where 
  username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  console.log(dbUser);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    const lengthOfPassword = password.length;
    if (lengthOfPassword < 5) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const addUserQuery = `
            INSERT INTO user(username, name, password, gender, location)
            VALUES (
                '${username}',
                '${name}',
                '${hashedPassword}',
                '${gender}',
                '${location}'
            );`;
      const dbResponse = await db.run(addUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  console.log(request.headers);
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
//api1 post path:/login/
app.post("/login/", async (request, response, next) => {
  const { username, password } = request.body;
  const getUserQuery = `
    select * from user
    where username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatches = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatches === false) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = {
        username: username,
      };
      console.log("jwt token created user logged in.");
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      console.log(jwtToken);
      response.send({ jwtToken });
    }
  }
});

//api2 get states api with authentication token..
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    select * from state;`;
  const statesArray = await db.all(getStatesQuery);
  response.send(statesArray);
});

//api3 get state details with stateId..
app.get("/states/:stateId", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatesQuery = `
    select * from state
    where stateId = ${stateId};`;
  const stateDetails = await db.get(getStatesQuery);
  response.send(stateDetails);
});

//api4 post district into district table..
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = response.body;
  const addDistrictQuery = `
    insert into district (districtName, stateId, cases, cured, active, deaths)
    values (
        '${districtName}',
        ${stateID},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
    );`;
  await db.run(addUserQuery);
  response.send("District Successfully Added");
});

//api5 get districts by id..
app.get(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictById = `
    select * from district
    where districtId = ${districtId};`;
    const districtDetails = await db.get(getDistrictById);
    response.send(districtDetails);
  }
);

//api6 delete district by id
app.delete(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    delete from district
    where districtId = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//api7 updateDistrict by id..
app.put(
  "/districts/:districtId",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `
    update district 
    set (
        districtName = '${districtName},
        stateId = ${stateId},
        cases = ${cases},
        cured = ${cured},
        active = ${active},
        deaths = ${deaths}
    )
    where districtId = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//api8 get state status
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    console.log("in stats api after authentication");
    const getStatesQuery = `select sum(cases), sum(cured), sum(active), sum(deaths) from district 
    where state_id = ${stateId};
    `;
    let stats = await db.all(getStatesQuery);
    stats = stats[0];
    response.send({
      totalCases: stats["sum(cases)"],
      totalCured: stats["sum(cured)"],
      totalActive: stats["sum(active)"],
      totalDeaths: stats["sum(deaths)"],
    });
  }
);

module.exports = app;
