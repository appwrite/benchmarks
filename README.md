# benchmarks
The Appwrite laboratory for benchmarks and experiments 🧪 👩‍🔬 🥽

## Build

```sh
docker build -t benchmarks .
```
## Run

### HTTP
```sh
docker run -it --env-file .env -v `pwd`/results:/results -e task=http benchmarks
```

### Database
```sh
docker run -it --env-file .env -v `pwd`/results:/results -e task=database benchmarks
```

### Storage
```sh
docker run -it --env-file .env -v `pwd`/results:/results -e task=storage benchmarks
```