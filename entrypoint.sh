 -l!/bin/sh
echo "Starting"

timestamp=$(date +%s)

mkdir ./results/$timestamp/

k6 run --out json=./results/$timestamp/data.json --out csv=./results/$timestamp/data.csv --summary-export=./results/$timestamp/summary.json ./$task.js