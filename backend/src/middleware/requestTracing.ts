// Copyright 2024 VoteChain Contributors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { randomUUID } from "crypto";
import { AsyncLocalStorage } from "async_hooks";
import { Request, Response, NextFunction } from "express";

type RequestContext = { traceId: string };

const requestContext = new AsyncLocalStorage<RequestContext>();
const levels = ["error", "warn", "info", "debug"] as const;
type LogLevel = (typeof levels)[number];

function configuredLevel(): LogLevel {
  const level = process.env.LOG_LEVEL?.toLowerCase();
  return levels.includes(level as LogLevel) ? (level as LogLevel) : "info";
}

function shouldLog(level: LogLevel) {
  return levels.indexOf(level) <= levels.indexOf(configuredLevel());
}

export function log(level: LogLevel, message: string, fields: Record<string, unknown> = {}) {
  if (!shouldLog(level)) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    traceId: requestContext.getStore()?.traceId,
    ...fields,
  };
  const output = JSON.stringify(entry);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.log(output);
}

export function requestTracing(req: Request, res: Response, next: NextFunction) {
  const incoming = req.header("X-Request-Id");
  const traceId = incoming && incoming.length <= 128 ? incoming : randomUUID();
  res.setHeader("X-Request-Id", traceId);
  requestContext.run({ traceId }, next);
}