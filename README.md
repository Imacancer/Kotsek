## This is a Flask Server Side for Kotsek

### Setting Up the Project

1. Create a virtual environment in the `backend` folder:

```bash
python3 -m venv backend
source backend/bin/activate  # On macOS/Linux
backend\Scripts\activate     # On Windows

```

## 2. installing dependencies

```bash

- pip install -r requirements.txt

```

## 3. Create the instance folder and SQLite database:

```bash
mkdir instance
touch instance/app.sqlite3

```

## 4. Initialize the database:

```bash

python manage.py db init

```

## when running the app

```bash

python manage.py runserver

```

## Other commands

## migrate the database

```bash
python manage.py db migrate

```

## drop the database

```bash
python manage.py db drop
```

## when adding a library

```bash
- pip install library_name
```

## since wala pa tayong table structure for project sample muna ginawa ko
