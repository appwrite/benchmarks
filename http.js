import { fail, group, check, sleep, randomSeed } from "k6";
import http from "k6/http";

const APPWRITE_ENDPOINT = __ENV.ENDPOINT || "";
const APPWRITE_PROJECT = __ENV.PROJECT || "";
const APPWRITE_KEY = __ENV.KEY || "";

const CONFIG_VUS = parseInt(__ENV.VUS) || 10;
const CONFIG_SEED = parseInt(__ENV.SEED) || 123456789;
const CONFIG_ITERATIONS = parseInt(__ENV.ITERATIONS) || 5;
const CONFIG_DURATION = __ENV.DURATION || "5m";

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
            "X-Appwrite-Key": APPWRITE_KEY,
        },
    };

    return {
        config,
        random
    };
};

export default ({ config }) => {
    const res = http.get(`${APPWRITE_ENDPOINT}/health`, config);

    check(res, {
        "status is 200": (r) => r.status === 200,
    });
};
