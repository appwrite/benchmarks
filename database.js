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

export const setup = () => {
    randomSeed(CONFIG_SEED);
    const random = Math.floor(Math.random() * 9999);
    const config = {
        headers: {
            "X-Appwrite-Project": APPWRITE_PROJECT,
        },
    };
    const req = http.post(
        `${APPWRITE_ENDPOINT}/database/collections`,
        JSON.stringify({
            collectionId: `benchmark-${random}`,
            name: `benchmark-${random}`,
            permission: "document",
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

    const collection = req.json();

    http.post(
        `${APPWRITE_ENDPOINT}/database/collections/${collection["$id"]}/attributes/string`,
        JSON.stringify(
            {
                collectionId: collection["$id"],
                attributeId: "name",
                size: 256,
                required: true,
            }
        ),
        {
            headers: {
                "X-Appwrite-Project": APPWRITE_PROJECT,
                "X-Appwrite-Key": APPWRITE_KEY,
                accept: "application/json",
                "Content-Type": "application/json",
            },
        }
    );
    
    http.post(
        `${APPWRITE_ENDPOINT}/database/collections/${collection["$id"]}/attributes/integer`,
        JSON.stringify(
            {
                collectionId: collection["$id"],
                attributeId: "year",
                required: true,
            }
        ),
        {
            headers: {
                "X-Appwrite-Project": APPWRITE_PROJECT,
                "X-Appwrite-Key": APPWRITE_KEY,
                accept: "application/json",
                "Content-Type": "application/json",
            },
        }
    );

    http.post(
        `${APPWRITE_ENDPOINT}/database/collections/${collection["$id"]}/attributes/boolean`,
        JSON.stringify(
            {
                collectionId: collectionId,
                attributeId: "active",
                required: true,
            }
        ),
        {
            headers: {
                "X-Appwrite-Project": APPWRITE_PROJECT,
                "X-Appwrite-Key": APPWRITE_KEY,
                accept: "application/json",
                "Content-Type": "application/json",
            },
        }
    );

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

    group("database", () => {
        const config = {
            headers: {
                "X-Appwrite-Project": APPWRITE_PROJECT,
                accept: "application/json",
                "Content-Type": "application/json",
            },
        };
        for (var id = 1; id <= 50; id++) {
            const created = http.post(
                `${APPWRITE_ENDPOINT}/database/collections/${collection["$id"]}/documents`,
                JSON.stringify({
                    collectionId: collection["$id"],
                    documentId: `document-${random}`,
                    data: {
                        name: `name-${id}`,
                        year: id,
                        active: id % 2 == 0,
                    },
                    read: ["role:all"],
                    write: ["role:all"],
                }),
                config
            );
            check(created, {
                "document created": (r) => r.status === 201,
            });
        }
        const url = `${APPWRITE_ENDPOINT}/database/collections/${collection["$id"]}/documents?project=${APPWRITE_PROJECT}`;
        const responses = http.batch([
            ["GET", url],
            ["GET", url + "&filters%5B%5D=active%3D1"],
            ["GET", url + "&filters%5B%5D=active!%3D1"],
        ]);
        check(responses[0], {
            "list documents status was 200": (res) => res.status === 200,
            "got documents": (res) => res.json().sum > 0,
        });
        check(responses[1], {
            "list documents status was 200": (res) => res.status === 200,
            "got documents": (res) => res.json().sum > 0,
        });
        check(responses[2], {
            "list documents status was 200": (res) => res.status === 200,
            "got documents": (res) => res.json().sum > 0,
        });
    });
    sleep(1);
};
