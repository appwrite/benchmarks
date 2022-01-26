import { fail, group, check, sleep, randomSeed } from "k6";
import http from "k6/http";
import { FormData } from 'https://jslib.k6.io/formdata/0.0.2/index.js';

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
            userId: `user-${random}`,
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
        

        // for (var id = 1; id <= 50; id++) {
            let formData = new FormData();
            let httpfile = http.file(binfile, 'file.png', 'image/png');
            console.log(binfile);
            console.log(httpfile);

            formData.append('file', httpfile, 'file.png');
            formData.append('bucketId', bucket["$id"]);
            formData.append('fileId', `file-${random}`);
            formData.append('read', ['role:all']);
            formData.append('write', ['role:all']);
            config.headers['Content-Type'] =  'multipart/form-data; boundary=' + formData.boundary;

            const created = http.post(
                `${APPWRITE_ENDPOINT}/storage/buckets/${bucket["$id"]}/files`,
                formData.body(),
                config
            );
            console.log(created.body);
            check(created, {
                "file created": (r) => r.status === 201,
            });
        // }
    });
    sleep(1);
};
