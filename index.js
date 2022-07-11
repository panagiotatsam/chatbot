const express = require("express");
const webpush = require("web-push");
const app = express();
const dfff = require("dialogflow-fulfillment");
const request = require("request");
const http = require("http");
const axios = require("axios");
const { Suggestion } = require("dialogflow-fulfillment");
const schedule = require("node-schedule");

const PUBLIC_VAPID_KEY =
  "BIA7EaF-xDzZGgPKnBWVzcvHNPhOPYWxdVcAGR4UhVzNtckAG5pj9NZEDCqifr_4pXrAgu0L5T7n0zIDFTZ-HTc";
const PRIVATE_VAPID_KEY = "dEJ8ay_Zq5UUQNBXSXhZZNg6suBwQPeI_j1TBM8vvIg";
const WEB_PUSH_CONTACT = "mailto: p.tsamasioti@hotmail.com";

webpush.setVapidDetails(WEB_PUSH_CONTACT, PUBLIC_VAPID_KEY, PRIVATE_VAPID_KEY);

var admin = require("firebase-admin");
var serviceAccount = require("./config/healthbe-1eca5-firebase-adminsdk-dpdir-f2766b2056.json");
const { userInfo } = require("os");
const { get } = require("request");

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://healthbe-1eca5-default-rtdb.firebaseio.com",
  });

  console.log("Connected to DB!");
} catch (error) {
  console.log("Error here!" + error);
}

var auth = admin.auth();
var db = admin.firestore();

app.get("/", (req, res) => {
  res.send("We are live");
});

app.post("/", express.json(), (req, res) => {
  const agent = new dfff.WebhookClient({
    request: req,
    response: res,
  });

  function handleWebHookIntent(agent) {
    agent.add("Hello! Welcome to MedBot!");
    agent.add(`Please provide me your email in order to proceed.`);
  }

  //users give their email for finding their uid of firestore authentication
  function GetEmail(agent) {
    var givenEmail = agent.parameters.email;
    var user = null;
    return axios
      .get(
        `https://firestore.googleapis.com/v1/projects/healthbe-1eca5/databases/(default)/documents/users`
      )
      .then((response) => {
        var userObject = response.data.documents.find(
          (u) => u.fields.email.stringValue == givenEmail
        );

        if (userObject) {
          user = userObject;
          userUid = user.fields.uid.stringValue;
          userFirstName = user.fields.firstName.stringValue;
          userLastName = user.fields.lastName.stringValue;
          agent.add(`Nice to meet you ${userFirstName} ${userLastName}!`);
          agent.add(`How can I help you?`);
          agent.add(`Choose one of the following options:`);
          agent.add(new Suggestion("Reminders"));
          agent.add(new Suggestion("Measurements"));
          agent.add(new Suggestion("Health Reports"));
          agent.add(new Suggestion("Emergency email"));
          agent.add(new Suggestion("Health questionnaire"));
        } else {
          agent.add(`Your email isn't right! Try again!`);
        }
      });
  }

  function backToMenu(agent) {
    agent.add("How can I help you?");
    agent.add(`Choose one of the following options:`);
    agent.add(new Suggestion("Reminders"));
    agent.add(new Suggestion("Measurements"));
    agent.add(new Suggestion("Health Reports"));
    agent.add(new Suggestion("Emergency email"));
    agent.add(new Suggestion("Health questionnaire"));
  }

  function RemindersCategory(agent) {
    agent.add(`You can choose one of the following categories:`);
    agent.add(new Suggestion("Back to menu"));
    agent.add(new Suggestion("Set reminder"));
    agent.add(new Suggestion("See Upcoming Reminder"));
  }

  //users want to set reminder in firestore
  function SetReminder(agent) {
    const date = agent.parameters.date;
    const reminderDate = new Date(date);
    const time = agent.parameters.time;
    const reminderTime = new Date(time);
    const reason = agent.parameters.reason;

    return db
      .collection("users")
      .doc(userUid)
      .get()
      .then((response) => {
        emailReminder = response._fieldsProto.email.stringValue;
        const nodemailer = require("nodemailer");
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: "medbotservice@gmail.com",
            pass: "dwdfkriqlipfbynj",
          },
          tls: {
            rejectUnauthorized: false,
          },
        });

        const mailOptions = {
          from: "medbotservice@gmail.com",
          to: emailReminder,
          subject: "Reminder",
          html: `<p> Reminder Date:</p> ${reminderDate.toDateString()}, <p> Reminder Time:</p> ${reminderTime.toTimeString()}, 
               <p> Reminder subject: </p> ${reason}`,
        };

        transporter.sendMail(mailOptions, function (error, info) {
          if (error) {
            return console.log(error);
          }
        });

        var admin = require("firebase-admin");

        agent.add(
          `Your reminder for ${reminderDate.toDateString()} added to calendar!`
        );
        agent.add(`Do you want anything else from me?`);
        agent.add(
          `If yes, choose one of the following options else choose exit.`
        );
        agent.add(new Suggestion("Reminders"));
        agent.add(new Suggestion("Measurements"));
        agent.add(new Suggestion("Health Reports"));
        agent.add(new Suggestion("Emergency email"));
        agent.add(new Suggestion("Health questionnaire"));
        agent.add(new Suggestion("Exit"));
        return db
          .collection("users")
          .doc(userUid)
          .collection("reminders")
          .add({
            reminderDate: reminderDate.toDateString(),
            reminderTime: reminderTime.toLocaleTimeString("en-GR", {
              hour12: false,
            }),
            reminderReason: reason,
          })
          .then((ref) => console.log("Reminder details added to DB!"));
      });
  }

  //users want to get last reminder from firestore
  function seeUpcomingReminder(agent) {
    return db
      .collection("users")
      .doc(userUid)
      .collection("reminders")
      .get()
      .then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          currentDate = new Date().toDateString();
          if (doc.exists && doc.data().reminderDate === currentDate) {
            agent.add(
              `Your upcoming reminder is ${doc.data().reminderReason} at ${
                doc.data().reminderDate
              } and ${doc.data().reminderTime}.`
            );
          }
        });
        agent.add(`Do you want anything else from me?`);
        agent.add(
          `If yes, choose one of the following options else choose exit.`
        );
        agent.add(new Suggestion("Reminders"));
        agent.add(new Suggestion("Measurements"));
        agent.add(new Suggestion("Health Reports"));
        agent.add(new Suggestion("Emergency email"));
        agent.add(new Suggestion("Health questionnaire"));
        agent.add(new Suggestion("Exit"));
      });
  }

  function MeasurementsCategory(agent) {
    agent.add(`You can choose one of the following categories:`);
    agent.add(new Suggestion("Back to menu"));
    agent.add(new Suggestion("Save measurements"));
    agent.add(new Suggestion("Weekly measurements"));
  }

  //users save measurements in firestore
  function SetMeasurements(agent) {
    agent.add(
      `What kind of measurements do you want to save? Blood pressure, body mass index(BMI) or heart rate?`
    );
    agent.add(new Suggestion("Blood pressure"));
    agent.add(new Suggestion("BMI"));
    agent.add(new Suggestion("Heart rate"));

    agent.add(new Suggestion("Back to menu"));
    const type = agent.parameters.measurements;
  }

  function BMI(agent) {
    const date = agent.parameters.date;
    const measurementDate = new Date(date);
    const numberWeight = Number(agent.parameters.numberWeight);
    const numberHeight = Number(agent.parameters.numberHeight);
    const bmi = Number(
      (numberWeight / (((numberHeight / 100) * numberHeight) / 100)).toFixed(2)
    );
    if (bmi <= 18.4) {
      bmiResult = "Underweight";
      agent.add(`Your BMI is ${bmi}. This result means that you may be underweight. Being underweight can be associated with a range of health issues. 
        If you're concerned about your weight, we recommend discussing your result with your GP, practice nurse or dietitian.`);
    } else if (bmi >= 18.5 && bmi <= 24.9) {
      bmiResult = "Normal weight";
      agent.add(
        `Your BMI is ${bmi}. This result means that you are a healthy body weight which is generally good for your health. Keep up the great work!`
      );
    } else if (bmi >= 25 && bmi <= 29.9) {
      bmiResult = "Overweight";
      agent.add(`Your BMI is ${bmi}. This result means that you may be overweight. Carrying extra weight is associated with a range of health concerns, 
        including being at an increased risk of heart disease. 
        If you're concerned about your weight, we recommend discussing your result with your GP, practice nurse or dietitian.`);
    } else if (bmi >= 30) {
      bmiResult = "Obesity";
      agent.add(`Your BMI is ${bmi}. This result means that you may be obese. Obesity is associated with a range of health concerns, 
        including being at an increased risk of heart disease. 
        If you're concerned about your weight, we recommend discussing your result with your GP, 
        practice nurse or dietitian.`);
    }
    return db
      .collection("users")
      .doc(userUid)
      .collection("body mass index")
      .orderBy("bmiDate", "desc")
      .limit(1)
      .get()
      .then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          if (doc.exists) {
            agent.add(
              `Your previous BMI measurement was ${doc.data().bmiResult}`
            );
          }
        });

        agent.add(
          `I'll save your BMI measurements for ${measurementDate.toDateString()}!`
        );
        agent.add(`Do you want to save another measurement?`);
        agent.add(new Suggestion("Yes"));
        agent.add(new Suggestion("No"));
        return db
          .collection("users")
          .doc(userUid)
          .collection("body mass index")
          .add({
            bmiDate: measurementDate.toDateString(),
            numberWeight: numberWeight,
            numberHeight: numberHeight,
            bmiResult: bmiResult,
            bmi: bmi,
          })
          .then((ref) => console.log("Measurement details added to DB!"));
      });
  }

  function BloodPressure(agent) {
    const date = agent.parameters.date;
    const measurementDate = new Date(date);
    const numberSystolic = Number(agent.parameters.numberSystolic);
    const numberDiastolic = Number(agent.parameters.numberDiastolic);
    if (numberSystolic <= 119 && numberDiastolic <= 79) {
      bloodPressureResult = "normal";
      agent.add(`Your blood pressure was normal.`);
    } else if (120 <= numberSystolic <= 129 && 80 <= numberDiastolic <= 89) {
      bloodPressureResult = "at risk";
      agent.add(`Your blood pressure was at risk.`);
    } else if (numberSystolic >= 130 && numberDiastolic >= 90) {
      bloodPressureResult = "hypertension";
      agent.add(`You have hypertension.`);
    }
    return db
      .collection("users")
      .doc(userUid)
      .collection("blood pressure")
      .orderBy("bloodPressureDate", "desc")
      .limit(1)
      .get()
      .then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          if (doc.exists) {
            agent.add(
              `Your previous blood pressure measurement was ${
                doc.data().bloodPressureResult
              }`
            );
          }
        });
        agent.add(
          `I'll save your blood pressure measurements for ${measurementDate.toDateString()}!`
        );
        agent.add(`Do you want to save another measurement?`);
        agent.add(new Suggestion("Yes"));
        agent.add(new Suggestion("No"));
        return db
          .collection("users")
          .doc(userUid)
          .collection("blood pressure")
          .add({
            bloodPressureDate: measurementDate.toDateString(),
            numberSystolic: numberSystolic,
            numberDiastolic: numberDiastolic,
            bloodPressureResult: bloodPressureResult,
          })
          .then((ref) => console.log("Measurement details added to DB!"));
      });
  }

  function HeartRate(agent) {
    const date = agent.parameters.date;
    const measurementDate = new Date(date);
    const numberRate = Number(agent.parameters.numberRate);
    if (numberRate <= 59.9) {
      heartRateResult = "not normal";
      agent.add(`Your heart rate was not normal.`);
    } else if (numberRate >= 60 && numberRate <= 99.9) {
      heartRateResult = "normal";
      agent.add(`Your heart rate was normal.`);
    } else if (numberRate >= 100) {
      heartRateResult = "dangerous";
      agent.add(`Your heart rate was dangerous.`);
    }
    return db
      .collection("users")
      .doc(userUid)
      .collection("heart rate")
      .orderBy("heartRateDate", "desc")
      .limit(1)
      .get()
      .then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          if (doc.exists) {
            agent.add(
              `Your previous heart rate measurement was ${
                doc.data().heartRateResult
              }.`
            );
          }
        });
        agent.add(
          `Okay I'll save your heart rate measurements for ${measurementDate.toDateString()} for you!`
        );
        agent.add(`Do you want to save another measurement?`);
        agent.add(new Suggestion("Yes"));
        agent.add(new Suggestion("No"));
        return db
          .collection("users")
          .doc(userUid)
          .collection("heart rate")
          .add({
            heartRateDate: measurementDate.toDateString(),
            numberRate: numberRate,
            heartRateResult: heartRateResult,
          })
          .then((ref) => console.log("Measurement details added to DB!"));
      });
  }

  function weeklyMeasurements(agent) {
    return db
      .collection("users")
      .doc(userUid)
      .collection("blood pressure")
      .orderBy("bloodPressureDate", "asc")
      .limit(7)
      .get()
      .then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          if (doc.exists) {
            agent.add(`Here are your blood pressure measurements:`);
            agent.add(`Your last measurement was ${
              doc.data().numberSystolic
            } your systolic blood pressure and 
              ${doc.data().numberDiastolic} your diastolic blood pressure for ${
              doc.data().bloodPressureDate
            }.`);
          }
        });
        return db
          .collection("users")
          .doc(userUid)
          .collection("heart rate")
          .orderBy("heartRateDate", "asc")
          .limit(7)
          .get()
          .then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
              if (doc.exists) {
                agent.add(`Here are your heart rate measurements:`);
                agent.add(
                  `Your last measurement was ${
                    doc.data().numberRate
                  } your heart rate for ${doc.data().measurementDate}.`
                );
              }
            });
            return db
              .collection("users")
              .doc(userUid)
              .collection("body mass index")
              .orderBy("bmiDate", "asc")
              .limit(7)
              .get()
              .then((querySnapshot) => {
                querySnapshot.forEach((doc) => {
                  if (doc.exists) {
                    agent.add(`Here are your body mass index measurements:`);
                    agent.add(`Your last measurement was ${
                      doc.data().numberHeight
                    } your height and 
              ${doc.data().numberWeight} your weight for ${
                      doc.data().bmiDate
                    }.`);
                  }
                });
                agent.add(`Do you want anything else from me?`);
                agent.add(
                  `If yes, choose one of the following options else choose exit.`
                );
                agent.add(new Suggestion("Reminders"));
                agent.add(new Suggestion("Measurements"));
                agent.add(new Suggestion("Health Reports"));
                agent.add(new Suggestion("Emergency email"));
                agent.add(new Suggestion("Health questionnaire"));
                agent.add(new Suggestion("Exit"));
              });
          });
      });
  }

  function HealthReportsCategory(agent) {
    agent.add(`You can choose one of the following categories:`);
    agent.add(new Suggestion("Back to menu"));
    agent.add(new Suggestion("Average of measurements"));
    agent.add(new Suggestion("Minimum of measurements"));
    agent.add(new Suggestion("Maximum of measurements"));
  }

  function average(agent) {
    return db
      .collection("users")
      .doc(userUid)
      .collection("blood pressure")
      .get()
      .then((querySnapshot) => {
        let sumSystolic = 0;
        let sumDiastolic = 0;
        let numofdiastolic = 0;
        let numofsystolic = 0;
        querySnapshot.forEach((doc) => {
          if (doc.exists) {
            sumSystolic = sumSystolic + doc.data().numberSystolic;
            sumDiastolic = sumDiastolic + doc.data().numberDiastolic;
            numofsystolic++;
            numofdiastolic++;
          }
        });
        let avgSystolic = sumSystolic / numofsystolic;
        let avgDiastolic = sumDiastolic / numofdiastolic;
        agent.add(
          `Your average of blood pressure measurements is ${avgSystolic} for systolic and ${avgDiastolic} for diastolic blood pressure.`
        );
        return db
          .collection("users")
          .doc(userUid)
          .collection("heart rate")
          .get()
          .then((querySnapshot) => {
            let sumHeartRate = 0;
            let numofheartrate = 0;
            querySnapshot.forEach((doc) => {
              if (doc.exists) {
                sumHeartRate = sumHeartRate + doc.data().numberRate;
                numofheartrate++;
              }
            });
            let avgHeartRate = sumHeartRate / numofheartrate;
            agent.add(
              `Your average of heart rate measurements is ${avgHeartRate}. `
            );
            return db
              .collection("users")
              .doc(userUid)
              .collection("body mass index")
              .get()
              .then((querySnapshot) => {
                let sumBmi = 0;
                let numofbmi = 0;
                querySnapshot.forEach((doc) => {
                  if (doc.exists) {
                    sumBmi = sumBmi + doc.data().bmi;
                    numofbmi++;
                  }
                });
                let avgBmi = sumBmi / numofbmi;
                agent.add(`Your average of BMI measurements is ${avgBmi}.`);
                agent.add(`Do you want anything else from me?`);
                agent.add(
                  `If yes, choose one of the following options else choose exit.`
                );
                agent.add(new Suggestion("Reminders"));
                agent.add(new Suggestion("Measurements"));
                agent.add(new Suggestion("Health Reports"));
                agent.add(new Suggestion("Emergency email"));
                agent.add(new Suggestion("Health questionnaire"));
                agent.add(new Suggestion("Exit"));
              });
          });
      });
  }

  function minimum(agent) {
    return db
      .collection("users")
      .doc(userUid)
      .collection("heart rate")
      .orderBy("numberRate", "asc")
      .limit(1)
      .get()
      .then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          if (doc.exists) {
            console.log(doc.data().numberRate);
            minNumberRate = doc.data().numberRate;
            agent.add(`Your minimum heart rate was ${minNumberRate}`);
          }
        });
        return db
          .collection("users")
          .doc(userUid)
          .collection("blood pressure")
          .orderBy("numberDiastolic", "asc")
          .limit(1)
          .orderBy("numberSystolic", "asc")
          .limit(1)
          .get()
          .then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
              if (doc.exists) {
                minNumberSystolic = doc.data().numberSystolic;
                minNumberDiastolic = doc.data().numberDiastolic;
                agent.add(
                  `Your minimum systolic blood pressure was ${minNumberSystolic}`
                );
                agent.add(
                  `Your minimum diastolic blood pressure was ${minNumberDiastolic}`
                );
              }
            });
            return db
              .collection("users")
              .doc(userUid)
              .collection("body mass index")
              .orderBy("bmi", "asc")
              .limit(1)
              .get()
              .then((querySnapshot) => {
                querySnapshot.forEach((doc) => {
                  if (doc.exists) {
                    minBmi = doc.data().bmi;
                    agent.add(`Your minimum bmi was ${minBmi}`);
                  }
                });
                agent.add(`Do you want anything else from me?`);
                agent.add(
                  `If yes, choose one of the following options else choose exit.`
                );
                agent.add(new Suggestion("Reminders"));
                agent.add(new Suggestion("Measurements"));
                agent.add(new Suggestion("Health Reports"));
                agent.add(new Suggestion("Emergency email"));
                agent.add(new Suggestion("Health questionnaire"));
                agent.add(new Suggestion("Exit"));
              });
          });
      });
  }

  function maximum(agent) {
    return db
      .collection("users")
      .doc(userUid)
      .collection("heart rate")
      .orderBy("numberRate", "desc")
      .limit(1)
      .get()
      .then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          if (doc.exists) {
            maxNumberRate = doc.data().numberRate;
            agent.add(`Your maximum heart rate was ${maxNumberRate}`);
          }
        });
        return db
          .collection("users")
          .doc(userUid)
          .collection("blood pressure")
          .orderBy("numberDiastolic", "desc")
          .limit(1)
          .orderBy("numberSystolic", "desc")
          .limit(1)
          .get()
          .then((querySnapshot) => {
            querySnapshot.forEach((doc) => {
              if (doc.exists) {
                maxNumberSystolic = doc.data().numberSystolic;
                maxNumberDiastolic = doc.data().numberDiastolic;
                agent.add(
                  `Your maximum systolic blood pressure was ${maxNumberSystolic}`
                );
                agent.add(
                  `Your maximum diastolic blood pressure was ${maxNumberDiastolic}`
                );
              }
            });
            return db
              .collection("users")
              .doc(userUid)
              .collection("body mass index")
              .orderBy("bmi", "desc")
              .limit(1)
              .get()
              .then((querySnapshot) => {
                querySnapshot.forEach((doc) => {
                  if (doc.exists) {
                    maxBmi = doc.data().bmi;
                    agent.add(`Your maximum Bmi was ${maxBmi}`);
                  }
                });
                agent.add(`Do you want anything else from me?`);
                agent.add(
                  `If yes, choose one of the following options else choose exit.`
                );
                agent.add(new Suggestion("Reminders"));
                agent.add(new Suggestion("Measurements"));
                agent.add(new Suggestion("Health Reports"));
                agent.add(new Suggestion("Emergency email"));
                agent.add(new Suggestion("Health questionnaire"));
                agent.add(new Suggestion("Exit"));
              });
          });
      });
  }

  function emergency(agent) {
    agent.add(`Could you give me the email of your doctor?`);
    agent.add(new Suggestion("Back to menu"));
  }

  function emergencyEmail(agent) {
    const emailEmergency = agent.parameters.emailEmergency;
    const phone = agent.parameters.phone;
    const emailReason = agent.parameters.emailReason;

    var User = null;
    return axios
      .get(
        `https://firestore.googleapis.com/v1/projects/healthbe-1eca5/databases/(default)/documents/users`
      )
      .then((response) => {
        var phoneObject = response.data.documents.find(
          (u) => u.fields.phone.integerValue == phone
        );
        if (phoneObject) {
          User = phoneObject;
          UserEmail = User.fields.email.stringValue;
          UserPhone = User.fields.phone.integerValue;
          UserFirstName = User.fields.firstName.stringValue;
          UserLastName = User.fields.lastName.stringValue;

          const nodemailer = require("nodemailer");
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: "medbotservice@gmail.com",
              pass: "dwdfkriqlipfbynj",
            },
            tls: {
              rejectUnauthorized: false,
            },
          });

          const mailOptions = {
            from: "medbotservice@gmail.com",
            to: emailEmergency,
            subject: "Emergency Email",
            html: `<p> Name:</p> ${UserFirstName} ${UserLastName}, <p> Email: </p> ${UserEmail}, <p> Phone Number: </p> ${UserPhone}, <p> Reason: </p> ${emailReason}`,
          };

          transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
              return console.log(error);
            }
          });

          agent.add(
            `Okay, I'll send the emergency email to your doctor immediately!`
          );
          agent.add(`Do you want anything else from me?`);
          agent.add(
            `If yes, choose one of the following options else choose exit.`
          );
          agent.add(new Suggestion("Reminders"));
          agent.add(new Suggestion("Measurements"));
          agent.add(new Suggestion("Health Reports"));
          agent.add(new Suggestion("Emergency email"));
          agent.add(new Suggestion("Health questionnaire"));
          agent.add(new Suggestion("Exit"));
        } else if (phone != phoneUser) {
          agent.add(`Your phone isn't right! Try again!`);
        }
      });
  }

  function duration(agent) {
    agent.add(`Let's see your measurements.`);
    agent.add(` With which kind of measurement do you want to start?`);
    agent.add(`Blood pressure, body mass index(BMI) or heart rate?`);
    agent.add(new Suggestion("Blood pressure"));
    agent.add(new Suggestion("BMI"));
    agent.add(new Suggestion("Heart rate"));
  }

  function answerno(agent) {
    agent.add(`Thank you! Do you want anything else from me?`);
    agent.add(`If yes, choose one of the following options else choose exit.`);
    agent.add(new Suggestion("Reminders"));
    agent.add(new Suggestion("Measurements"));
    agent.add(new Suggestion("Health Reports"));
    agent.add(new Suggestion("Emergency email"));
    agent.add(new Suggestion("Medical health questionnaire"));
    agent.add(new Suggestion("Exit"));
  }

  function answeryes(agent) {
    agent.add("Which measurement do you want?");
    agent.add(new Suggestion("Blood pressure"));
    agent.add(new Suggestion("BMI"));
    agent.add(new Suggestion("Heart rate"));
  }

  function questionnaire(agent) {
    agent.add(`Let's take a mini medical health questionnaire!`);
    agent.add(`How do you feel today compared to yesterday?`);
    agent.add(new Suggestion("Back to menu"));
  }

  function positivefeeling(agent) {
    feeling = agent.parameters.positiveFeeling;
    agent.add(`So, you don't have any symptoms, right?`);
    agent.add(
      `If yes, tell me your symptoms. If not, that's great, I am happy for you!`
    );
    agent.add(`Do you want anything else from me?`);
    agent.add(`If yes, choose one of the following options else choose exit.`);
    agent.add(new Suggestion("Reminders"));
    agent.add(new Suggestion("Measurements"));
    agent.add(new Suggestion("Health Reports"));
    agent.add(new Suggestion("Emergency email"));
    agent.add(new Suggestion("Exit"));
    return db
      .collection("users")
      .doc(userUid)
      .collection("questionnaires")
      .add({
        questionnaireFeeling: feeling,
        createdAt: new Date().toDateString(),
      })
      .then((ref) => console.log("Measurement details added to DB!"));
  }

  function negativefeeling(agent) {
    feeling = agent.parameters.negativeFeeling;
    agent.add(`Let me ask you some questions to find out what's wrong with you. 
      Based on your answers I can find the most likely cause and give you some advice on how to get better.`);
    agent.add(`Now tell me, what are your symptoms?`);
    return db
      .collection("users")
      .doc(userUid)
      .collection("questionnaires")
      .add({
        questionnaireFeeling: feeling,
        createdAt: new Date().toDateString(),
      })
      .then((ref) => console.log("Measurement details added to DB!"));
  }

  function symptoms(agent) {
    symptom = agent.parameters.symptoms;
    agent.add(`How  long do you have ${symptom}?`);
    return db
      .collection("users")
      .doc(userUid)
      .collection("questionnaires")
      .get()
      .then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
          if (doc.data().createdAt == new Date().toDateString()) {
            id = doc.id;
            return db
              .collection("users")
              .doc(userUid)
              .collection("questionnaires")
              .doc(id)
              .set(
                {
                  questionnaireSymptom: symptom,
                },
                { merge: true }
              )
              .then((ref) => console.log("Measurement details updated to DB!"));
          }
        });
      });
  }

  function endofconversation(agent) {
    agent.add(`Have a nice day! Talk to me tomorrow!`);
  }

  var intentMap = new Map();
  intentMap.set("Welcome Intent", handleWebHookIntent);
  intentMap.set("Get Email", GetEmail);
  intentMap.set("back to menu", backToMenu);
  intentMap.set("Measurements Category", MeasurementsCategory);
  intentMap.set("Reminders Category", RemindersCategory);
  intentMap.set("Set Reminder", SetReminder);
  intentMap.set("See Upcoming Reminder", seeUpcomingReminder);
  intentMap.set("Set Daily Measurements", SetMeasurements);
  intentMap.set("Heart Rate", HeartRate);
  intentMap.set("Body Mass Index", BMI);
  intentMap.set("Blood Pressure", BloodPressure);
  intentMap.set("duration", duration);
  intentMap.set("answer no", answerno);
  intentMap.set("answer yes", answeryes);
  intentMap.set("Positive feeling", positivefeeling);
  intentMap.set("Negative feeling", negativefeeling);
  intentMap.set("Symptoms", symptoms);
  intentMap.set("end of conversation", endofconversation);
  intentMap.set("Weekly measurements", weeklyMeasurements);
  intentMap.set("Health Reports Category", HealthReportsCategory);
  intentMap.set("Minimum of measurements", minimum);
  intentMap.set("Maximum of measurements", maximum);
  intentMap.set("Average of measurements", average);
  intentMap.set("emergency", emergency);
  intentMap.set("emergency email", emergencyEmail);
  intentMap.set("Health questionnaire", questionnaire);
  agent.handleRequest(intentMap);
});

app.listen(4040, () => console.log("Server is live at port 4040"));
