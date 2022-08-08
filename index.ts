import axios, { AxiosError } from "axios";

/**
 * 環境変数
 */
require("dotenv").config();

if (!process.env.MIRAKURUN_URL) throw new Error("MIRAKURUN_URL is not set");
if (!process.env.LOG_WEBHOOK_URL)
  throw new Error("LOG_WEBHOOK_URL is not set");
if (!process.env.EVENTS_WEBHOOK_URL)
  throw new Error("EVENTS_WEBHOOK_URL is not set");

const MIRAKURUN_URL = process.env.MIRAKURUN_URL; // Mirakurun URL (e.g: http://mirakurun:40772 )
const LOG_WEBHOOK_URL = process.env.LOG_WEBHOOK_URL;
const EVENTS_WEBHOOK_URL = process.env.EVENTS_WEBHOOK_URL;

/**
 * 各種定数
 */
const LOG_STREAM_API_PATH = "/api/log/stream" as const;
const EVENTS_STREAM_API_PATH = "/api/events/stream" as const;
const MIRAKURUN_LOG_WEBHOOK_USERNAME = "Mirakurun Log" as const;
const MIRAKURUN_EVENTS_WEBHOOK_USERNAME = "Mirakurun Events" as const;
const WEBHOOK_TIME_INTERVAL = 1000 * 5

interface Item {
  timestamp: number;
  data: Buffer;
}

/**
 * キャッシュ
 */
let logCache = new Array<Item>();
let eventsCache = new Array<Item>();

/**
 * Discord Webhook に投げる
 * @param text テキスト
 */
async function postWebhook(webhookUrl: string, username: string, content: string) {
  return await axios.post(
    webhookUrl,
    {
      username,
      content,
    },
    {
      headers: {
        Accept: "application/json",
        "Content-type": "application/json",
      },
    }
  ).catch((err) => {
    throw err as AxiosError;
  })
}

/**
 * Mirakurun のログストリームを取得
 */
async function getLogStream(onData: (data: Buffer) => void) {
  const response = await axios.get(`${MIRAKURUN_URL}${LOG_STREAM_API_PATH}`, {
    responseType: "stream",
  }).catch((err) => {
    throw err as AxiosError;
  })

  const stream = response.data;

  stream.on("data", (data: Buffer) => {
    console.log(String(data));
    onData(data);
  });

  stream.on("end", () => {
    console.log("stream done");
  });
}

/**
 * Mirakurun のイベントストリームを取得
 */
async function getEventsStream(onData: (data: Buffer) => void) {
  const response = await axios.get(
    `${MIRAKURUN_URL}${EVENTS_STREAM_API_PATH}`,
    {
      responseType: "stream",
    }
  ).catch((err) => {
    throw err as AxiosError;
  })

  const stream = response.data;

  stream.on("data", (data: Buffer) => {
    console.log(String(data));
    onData(data);
  });

  stream.on("end", () => {
    console.log("stream done");
  });
}

function cacheStreams() {
  Promise.all([
    getLogStream((data) => {
      logCache.push({
        timestamp: Date.now(),
        data,
      });
    }),
    getEventsStream((data) => {
      eventsCache.push({
        timestamp: Date.now(),
        data,
      });
    }),
  ]);
}

/**
 * 5秒毎 Discord Webhook に送信するタスク
 */
function runWebhook() {
  setInterval(async () => {
    console.log("Log Cache: " + logCache);
    if (logCache.length >= 1) {
      const logFirst = logCache[0];
      if (logFirst !== undefined) {
        await postWebhook(LOG_WEBHOOK_URL, MIRAKURUN_LOG_WEBHOOK_USERNAME, String(logFirst.data));
        logCache = logCache.filter(
          (item) => item.timestamp !== logFirst.timestamp
        );
        console.log("Log Cache: " + logCache);
      }
    }

    if (eventsCache.length >= 1) {
      console.log("Events Cache: " + eventsCache);
      const eventFirst = eventsCache[0];
      if (eventFirst !== undefined) {
        await postWebhook(EVENTS_WEBHOOK_URL, MIRAKURUN_EVENTS_WEBHOOK_USERNAME, String(eventFirst.data))
        eventsCache = eventsCache.filter(
          (item) => item.timestamp !== eventFirst.timestamp
        );
        console.log("Events Cache: " + eventsCache);
      }
    }
  }, WEBHOOK_TIME_INTERVAL);
}

runWebhook();
cacheStreams();
