const APP_ID = "7684fcafa4e447d18c2d0200b17ae684";
const CHANNEL = sessionStorage.getItem("room");
const TOKEN = sessionStorage.getItem("token");
let UID = Number(sessionStorage.getItem("UID"));
const USER_ACCOUNT = sessionStorage.getItem("userAccount");
const RTMTOKEN = sessionStorage.getItem("rtmtoken");

let NAME = sessionStorage.getItem("name");
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;
var recognition = new SpeechRecognition();
var transContent = "";
var noteContent = "";
recognition.continuous = true;
var isLoggedIn = false;
var transcriptActive = false;

const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
const clientRTM = AgoraRTM.createInstance(APP_ID);
const appCertificate = "Certificate";
const expireTimeInSeconds = 3600;
const currentTimestamp = Date.now();
const expireTimestamp = currentTimestamp + expireTimeInSeconds;
const RTMChannel = clientRTM.createChannel(CHANNEL);

let localTracks = [];
let remoteUsers = {};

let joinAndDisplayLocalStream = async () => {
  document.getElementById("room-name").innerText = CHANNEL;

  client.on("user-published", handleUserJoined);
  client.on("user-left", handleUserLeft);

  try {
    await client.join(APP_ID, CHANNEL, TOKEN, UID);
    await clientRTM.login({ uid: USER_ACCOUNT, token: RTMTOKEN });
    RTMChannel.join().then(() => {
      console.log("AgoraRTM client channel join success.");
      RTMChannel.on('ChannelMessage', ({ text }, senderId) => {
        console.log("Message received successfully.");
        console.log("The message is: " + text + " by " + senderId);
      });
    });
  } catch (error) {
    console.error(error);
    window.open("/", "_self");
  }

  localTracks = await AgoraRTC.createMicrophoneAndCameraTracks();

  let member = await createMember();

  let player = `<div class="video-container" id="user-container-${UID}">
                    <div class="username-wrapper"><span class="user-name">${member.name}</span></div>
                    <div class="video-player" id="user-${UID}"></div>
                </div>`;
  document
    .getElementById("video-streams")
    .insertAdjacentHTML("beforeend", player);

  localTracks[1].play(`user-${UID}`);

  await client.publish([localTracks[0], localTracks[1]]);
};

let handleUserJoined = async (user, mediaType) => {
  remoteUsers[user.uid] = user;
  await client.subscribe(user, mediaType);

  if (mediaType === "video") {
    let player = document.getElementById(`user-container-${user.uid}`);
    if (player != null) {
      player.remove();
    }

    let member = await getMember(user);

    player = `<div class="video-container" id="user-container-${user.uid}">
                    <div class="username-wrapper"><span class="user-name">${member.name}</span></div>
                    <div class="video-player" id="user-${user.uid}"></div>
                </div>`;
    document
      .getElementById("video-streams")
      .insertAdjacentHTML("beforeend", player);

    user.videoTrack.play(`user-${user.uid}`);
  }

  if (mediaType === "audio") {
    user.audioTrack.play();
  }
};

let handleUserLeft = async (user) => {
  delete remoteUsers[user.uid];
  document.getElementById(`user-container-${user.uid}`).remove();
};

let leaveAndRemoveLocalStream = async () => {
  for (let i = 0; i < localTracks.length; i++) {
    localTracks[i].stop();
    localTracks[i].close();
  }

  await client.leave();
  deleteMember();
  window.open("/", "_self");
};

let toggleCamera = async (e) => {
  if (localTracks[1].muted) {
    await localTracks[1].setMuted(false);
    e.target.style.backgroundColor = "#fff";
  } else {
    await localTracks[1].setMuted(true);
    e.target.style.backgroundColor = "rgb(255, 80, 80, 1)";
  }
};

let toggleMic = async (e) => {
  if (localTracks[0].muted) {
    await localTracks[0].setMuted(false);
    e.target.style.backgroundColor = "#fff";
  } else {
    await localTracks[0].setMuted(true);
    e.target.style.backgroundColor = "rgb(255, 80, 80, 1)";
  }
};

let toggleTranscript = async (e) => {
  if (transcriptActive) {
    recognition.stop();
    e.target.style.backgroundColor = "#fff";
    transcriptActive = false;
  } else {
    recognition.start();
    e.target.style.backgroundColor = "rgb(255, 80, 80, 1)";
    transcriptActive = true;
  }
};

transcriptText = document.getElementById("transcriptText");

recognition.onresult = (event) => {
  var current = event.resultIndex;
  const text = event.results[current][0].transcript;
  const confidence = event.results[current][0].confidence;
  if (!localTracks[0].muted) {
    newText = NAME + ": " + text;
    //transcriptText.innerText = NAME + ": " + text;
    RTMChannel.sendMessage({ text: newText });
  }
};

// RTMChannel.on("ChannelMessage", ({ text }) => {
//   transcriptText.innerText = text;
//   console.log("Message received successfully.");
// });

let createMember = async () => {
  let response = await fetch("/create_member/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: NAME, room_name: CHANNEL, UID: UID }),
  });
  let member = await response.json();
  return member;
};

let getMember = async (user) => {
  let response = await fetch(
    `/get_member/?UID=${user.uid}&room_name=${CHANNEL}`
  );
  let member = await response.json();
  return member;
};

let deleteMember = async () => {
  let response = await fetch("/delete_member/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: NAME, room_name: CHANNEL, UID: UID }),
  });
  let member = await response.json();
};

joinAndDisplayLocalStream();

window.addEventListener("beforeunload", deleteMember);

document
  .getElementById("leave-btn")
  .addEventListener("click", leaveAndRemoveLocalStream);
document.getElementById("camera-btn").addEventListener("click", toggleCamera);
document.getElementById("mic-btn").addEventListener("click", toggleMic);
document
  .getElementById("trans-btn")
  .addEventListener("click", toggleTranscript);
