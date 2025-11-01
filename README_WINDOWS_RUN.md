# Запуск проекта на Windows (PowerShell)

Ниже  финальные и проверенные инструкции по локальному запуску проекта в Windows. Скрипты находятся в папке scripts/ и уже адаптированы для Windows (включая явный вызов yarn.cmd для запуска frontend).

## Подготовка (один раз)

1) Установите Docker Desktop и запустите его.
2) Установите Python 3.11 (если ещё не установлен). Один из способов:

`powershell
winget install --id Python.Python.3.11 -e --source winget
`

3) Установите Node.js LTS (если ещё не установлен):

`powershell
winget install --id OpenJS.NodeJS.LTS -e --source winget
`

4) (Опционально) Установите yarn через npm (если хотите глобально):

`powershell
npm install -g yarn
`

## Быстрые команды для запуска (рекомендуется запускать из корня репозитория SER-main)

1) Поднять MongoDB (Docker):

`powershell
.\scripts\start-mongo.ps1
`

2) Запустить backend (создаст/активирует venv и запустит uvicorn):

`powershell
.\scripts\start-backend.ps1
`

PID процесса будет сохранён в scripts/backend.pid.

3) Запустить frontend (yarn install + yarn start)

- Чтобы запустить frontend в фоновом/новом окне (рекомендую для просмотра логов):

`powershell
.\scripts\run-frontend-window.ps1
`

- Альтернативно, чтобы запустить в текущем окне (логи прямо тут):

`powershell
Set-Location .\frontend
http://localhost:8000='http://localhost:8000'
yarn.cmd start
`

4) Откройте браузер:

- Frontend: http://localhost:3000
- Backend API docs: http://localhost:8000/docs

## Остановка/очистка

Остановить backend (скрипт читает PID из scripts/backend.pid):

`powershell
.\scripts\stop-backend.ps1
`

Остановить и удалить локальный Mongo-контейнер (если нужно):

`powershell
docker stop skipay-mongo
docker rm skipay-mongo
`

## Пояснения и советы

- На Windows лучше вызывать yarn.cmd (это явный исполняемый пакет). Скрипты в scripts/ уже настроены так, чтобы не запускался yarn.ps1, который иногда открывается в редакторе из-за ассоциаций PowerShell.
- Скрипт start-all.ps1 запускает Mongo -> backend -> открывает новое окно для frontend (использует un-frontend-window.ps1).
- Если хотите видеть логи backend в реальном времени, запустите uvicorn в foreground вместо фонового старта (в ackend активируйте .venv и выполните python -m uvicorn server:app --reload --host 0.0.0.0 --port 8000).
- Если возникнут ошибки при установке зависимостей  пришлите вывод команд (yarn install / pip install -r requirements.txt) и я помогу.

Если нужно  могу подготовить docker-compose.yml для запуска всего стека в контейнерах (Mongo + backend + frontend) или автоматизировать создание ярлыка/таска на Windows.
