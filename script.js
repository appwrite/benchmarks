import { fail, group, check, sleep, randomSeed } from "k6";
import http from "k6/http";

const APPWRITE_ENDPOINT = __ENV.ENDPOINT || "";
const APPWRITE_PROJECT = __ENV.PROJECT || "";
const APPWRITE_KEY = __ENV.KEY || "";

const CONFIG_VUS = parseInt(__ENV.VUS) || 10;
const CONFIG_SEED = parseInt(__ENV.SEED) || 123456789;
const CONFIG_DURATION = __ENV.DURATION || "10s";

if (
    APPWRITE_ENDPOINT === "" ||
    APPWRITE_PROJECT === "" ||
    APPWRITE_KEY === ""
) {
    fail("Missing Appwrite Credentials!");
}

export let options = {
    vus: CONFIG_VUS,
    duration: CONFIG_DURATION,
};

export const setup = () => {
    randomSeed(CONFIG_SEED);
    const random = Math.floor(Math.random() * 9999);
    const config = {
        headers: {
            "X-Appwrite-Project": APPWRITE_PROJECT,
        },
    };
    const payload = {
        name: `benchmark-${random}`,
        read: ["*"],
        write: ["*"],
        rules: [
            {
                label: "Name",
                key: "name",
                type: "text",
                default: "Empty Name",
                required: true,
                array: false,
            },
            {
                label: "Year",
                key: "year",
                type: "numeric",
                default: 1970,
                required: true,
                array: false,
            },
            {
                label: "Active",
                key: "active",
                type: "boolean",
                default: false,
                required: true,
                array: false,
            },
        ],
    };
    const req = http.post(
        `${APPWRITE_ENDPOINT}/database/collections`,
        JSON.stringify(payload),
        {
            headers: {
                "X-Appwrite-Project": APPWRITE_PROJECT,
                "X-Appwrite-Key": APPWRITE_KEY,
                accept: "application/json",
                "Content-Type": "application/json",
            },
        }
    );
    const collection = req.json();
    return {
        config,
        random,
        collection,
    };
};

export default ({ config, random, collection }) => {
    const jar = http.cookieJar();
    group("register and login", () => {
        const payload = {
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

    group("database", () => {
        const config = {
            headers: {
                "X-Appwrite-Project": APPWRITE_PROJECT,
                "accept": "application/json",
                "Content-Type": "application/json",
            },
        };
        for (var id = 1; id <= 100; id++) {
            const created = http.post(
                `${APPWRITE_ENDPOINT}/database/collections/${collection["$id"]}/documents`,
                JSON.stringify({
                    collectionId: collection["$id"],
                    data: {
                        name: `name-${id}`,
                        year: id,
                        active: id % 2 == 0,
                    },
                    read: ["*"],
                    write: ["*"],
                }),
                config
            );
            check(created, {
                "document created": (r) => r.status === 201,
            });
        };
        const url = `${APPWRITE_ENDPOINT}/database/collections/${collection["$id"]}/documents?project=${APPWRITE_PROJECT}`;
        const responses = http.batch([
            ['GET', url],
            ['GET', url + "&filters%5B%5D=active%3D1"],
            ['GET', url + "&filters%5B%5D=active%3D0"]
        ]);
        check(responses[0], {
            'list documents status was 200': (res) => res.status === 200,
            'got documents': (res) => res.json().sum > 0
        });
        check(responses[1], {
            'list documents status was 200': (res) => res.status === 200,
            'got documents': (res) => res.json().sum > 0
        });
        check(responses[2], {
            'list documents status was 200': (res) => res.status === 200,
            'got documents': (res) => res.json().sum > 0
        });
    });
    sleep(1);
};
