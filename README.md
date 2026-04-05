# Wedding Planning App

This application is intended to help us with:
- managing the wedding (invitations, table arrangements)
- getting used to vibe-coding and exploring the capabilities of latest models


## How to Run Locally with Docker

Run the dev frontend server and the backend server. Hot-reload for frontend is supported.

```shell
docker compose up --build
```

### Local FE Configuration

The local FE is configurable by setting the following variables in the [`docker-compose.yml`](./docker-compose.yml):

| Variable Name | Value | Description |
| --- | --- | --- |
| `VITE_SKIP_AUTH` | `<empty>` | if you want to run without authentication, just set the `VITE_SKIP_AUTH=` to empty variable |
| `VITE_ENABLE_LOCAL_AUTH` | `true` | if you want to run with mocked authentication (e.g., to be able to test the behavior with multiple users), set the `VITE_ENABLE_LOCAL_AUTH=true`. *You also have to set the `ENABLE_LOCAL_AUTH` to `true` in the backend container*


## How to Deploy to Heroku

- we deploy in Basic Dynos which run for at most $7 per month

Use `release.sh`.

### Manual Process

Tag the container so that Heroku would understand where it should be deployed:

```shell
docker tag wedding-app registry.heroku.com/wedding-planning/web
```

Push the container:

```shell
docker push registry.heroku.com/wedding-planning/web
```

Release a new version of the application:

```shell
heroku container:release web
```

### How to Set Config Variables

```shell
# set environment variable
heroku config:set GOOGLE_CLIENT_ID=""

# unset environment variable
heroku config:unset GOOGLE_CLIENT_ID
```



### Setup Heroku
Install Heroku CLI:

```shell
curl https://cli-assets.heroku.com/install.sh | sh
```

Login:

```shell
heroku login
heroku container:login
```

Set the application name to `wedding-planning`

```shell
heroku git:remote -a wedding-planning
```
