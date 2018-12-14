import http, { ServerResponse } from "http";
import { GlobalPlugin } from "knub";
import { GuildArchives } from "../data/GuildArchives";
import { sleep } from "../utils";

const DEFAULT_PORT = 9920;
const archivesRegex = /^\/(spam-logs|archives)\/([a-z0-9\-]+)\/?$/i;

function notFound(res: ServerResponse) {
  res.statusCode = 404;
  res.end("Not Found");
}

export class LogServerPlugin extends GlobalPlugin {
  protected archives: GuildArchives;
  protected server: http.Server;

  async onLoad() {
    this.archives = new GuildArchives(null);

    this.server = http.createServer(async (req, res) => {
      const pathMatch = req.url.match(archivesRegex);
      if (!pathMatch) return notFound(res);

      const logId = pathMatch[2];

      if (pathMatch[1] === "spam-logs") {
        res.statusCode = 301;
        res.setHeader("Location", `/archives/${logId}`);
        return;
      }

      if (pathMatch) {
        const log = await this.archives.find(logId);
        if (!log) return notFound(res);

        res.setHeader("Content-Type", "text/plain; charset=UTF-8");
        res.end(log.body);
      }
    });

    let retried = false;

    this.server.on("error", async (err: any) => {
      if (err.code === "EADDRINUSE" && !retried) {
        console.log("Got EADDRINUSE, retrying in 2 sec...");
        retried = true;
        await sleep(2000);
        this.server.listen(this.configValue("port", DEFAULT_PORT));
      } else {
        throw err;
      }
    });

    this.server.listen(this.configValue("port", DEFAULT_PORT));
  }

  async onUnload() {
    return new Promise(resolve => {
      this.server.close(() => resolve());
    });
  }
}