import { fail, group, check, sleep, randomSeed } from "k6";
import http from "k6/http";

const APPWRITE_ENDPOINT = __ENV.ENDPOINT || "";
const APPWRITE_PROJECT = __ENV.PROJECT || "";
const APPWRITE_KEY = __ENV.KEY || "";

const CONFIG_VUS = parseInt(__ENV.VUS) || 10;
const CONFIG_SEED = parseInt(__ENV.SEED) || 123456789;
const CONFIG_ITERATIONS = parseInt(__ENV.ITERATIONS) || 5;

if (
    APPWRITE_ENDPOINT === "" ||
    APPWRITE_PROJECT === "" ||
    APPWRITE_KEY === ""
) {
    fail("Missing Appwrite Credentials!");
}

export let options = {
    discardResponseBodies: false,
    scenarios: {
        contacts: {
            executor: "per-vu-iterations",
            vus: CONFIG_VUS,
            iterations: CONFIG_ITERATIONS,
            maxDuration: "10m",
        },
    },
};

const binfiles = [];
const chunks = __ENV.CHUNKS || 10;
const chunkSize = __ENV.CHUNK_SIZE || 5 * 1024 * 1024;
const size = __ENV.SIZE || 1 * 1024 * 1024 * 1024;

console.log(JSON.stringify({
    chunks,
    chunkSize,
    size,

}));

for(let i = 0; i < chunks; i++) {
    binfiles.push(open(`./chunked_benchmark/chunks/c${i}.chunk`, 'b'));
}

const binfile = open('./file.png', 'b');
export const setup = () => {
    randomSeed(CONFIG_SEED);
    const random = Math.floor(Math.random() * 9999);
    const config = {
        headers: {
            "X-Appwrite-Project": APPWRITE_PROJECT,
        },
    };
    const req = http.post(
        `${APPWRITE_ENDPOINT}/storage/buckets`,
        JSON.stringify({
            bucketId: `benchmark-${random}`,
            name: `benchmark-${random}`,
            permission: "file",
            read: ["role:all"],
            write: ["role:all"],
        }),
        {
            headers: {
                "X-Appwrite-Project": APPWRITE_PROJECT,
                "X-Appwrite-Key": APPWRITE_KEY,
                accept: "application/json",
                "Content-Type": "application/json",
            },
        }
    );

    const bucket = req.json();

    return {
        config,
        random,
        bucket,
    };
};

export default ({ config, random, bucket }) => {
    const jar = http.cookieJar();
    group("register and login", () => {
        const payload = {
            userId: 'unique()',
            email: `user_${__VU}_${__ITER}_${random}@appwrite.io`,
            password: "AppwriteIsAwesome",
        };

        const created = http.post(`${APPWRITE_ENDPOINT}/account`, payload, config);
        check(created, {
            "account created": (r) => r.status === 201,
        });

        const login = http.post(
            `${APPWRITE_ENDPOINT}/account/sessions`,
            payload,
            config
        );
        check(login, {
            "account logged in": (r) => r.status === 201,
        });

        const cookie = login.cookies[`a_session_${APPWRITE_PROJECT}`][0].value;
        jar.set(APPWRITE_ENDPOINT, `a_session_${APPWRITE_PROJECT}`, cookie);

        const user = http.get(`${APPWRITE_ENDPOINT}/account`, config);
        check(user, {
            "account get": (r) => r.status === 200,
        });
    });

    group("storage", () => {
        const config = {
            headers: {
                "X-Appwrite-Project": APPWRITE_PROJECT,
                accept: "application/json",
            },
        };
        
        let fileId = undefined;
        for (var id = 0; id < chunks; id++) {
            console.log("chunk", id);
            console.log("fileId", fileId);
            const start = id * chunkSize;
            const end = Math.min(id * chunkSize + chunkSize - 1, size)
            config.headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
            if(fileId) {
                config.headers["X-Appwrite-ID"] = fileId;
            }
            const created = http.post(
                `${APPWRITE_ENDPOINT}/storage/buckets/${bucket["$id"]}/files`,
                {
                    fileId: "unique()",
                    file: http.file(binfiles[id], 'file.bin'),
                },
                config
            );
            check(created, {
                "file created": (r) => r.status === 201,
            });
            if(!fileId) {
                fileId = created.json()["$id"];
            }
        }
    });
    sleep(1);
};
