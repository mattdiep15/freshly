import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.hourly("lifecycle tick", { minuteUTC: 0 }, internal.lifecycle.tick, {});

export default crons;
