IMAGE_NAME := ghcr.io/miyabi/inkstation
TAG := latest

.PHONY: build run clean

build:
	docker build -t $(IMAGE_NAME):$(TAG) .

run: build
	docker compose up -d --no-pull

clean:
	docker compose down
