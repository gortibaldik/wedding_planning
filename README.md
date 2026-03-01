# Wedding Planning App

This application is intended to help us with:
- managing the wedding (invitations, table arrangements)
- getting used to vibe-coding and exploring the capabilities of latest models


## How to Run Locally with Docker

Run the dev frontend server and the backend server. Hot-reload for frontend is supported.

```shell
docker compose up --build
```

If you want to run without authentication, just set the `VITE_SKIP_AUTH` to empty variable in the file `frontend/.env.local`.

## How to Deploy to Heroku

- we deploy in Basic Dynos which run for at most $7 per month

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



