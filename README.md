# benchmarks
The Appwrite laboratory for benchmarks and experiments 🧪 👩‍🔬 🥽

## Build

```sh
docker build -t benchmarks .
```
## Run

```sh
docker run -it --env-file .env -v `pwd`/results:/results  benchmarks
```