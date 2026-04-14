import asyncio
from uuid import uuid4
from botocore.exceptions import ClientError
import boto3
from fastapi import HTTPException, UploadFile
import os

from app.core.config import settings


class StorageService:
    def __init__(self):
        # Отключаем прокси через переменные окружения
        os.environ['NO_PROXY'] = 'localhost,127.0.0.1'
        os.environ['no_proxy'] = 'localhost,127.0.0.1'
        
        # Создаем клиент с явным указанием не использовать прокси
        self.s3_client = boto3.client(
            "s3",
            endpoint_url=settings.MINIO_ENDPOINT,
            aws_access_key_id=settings.MINIO_ACCESS_KEY,
            aws_secret_access_key=settings.MINIO_SECRET_KEY,
            region_name="us-east-1",
            use_ssl=settings.MINIO_SECURE,
            config=boto3.session.Config(
                proxies={},  # Явно указываем пустой словарь прокси
                connect_timeout=5,
                read_timeout=5,
                retries={'max_attempts': 2}
            )
        )
        self.bucket = settings.MINIO_BUCKET

    async def ensure_bucket_exists(self):
        """Создаёт бакет, если его нет"""
        try:
            self.s3_client.head_bucket(Bucket=self.bucket)
        except ClientError as e:
            error_code = e.response.get('Error', {}).get('Code')
            if error_code in ['404', 'NoSuchBucket']:
                self.s3_client.create_bucket(Bucket=self.bucket)
            else:
                raise

    async def upload_file(self, file: UploadFile, user_id: int) -> str:
        """Загружает файл в MinIO и возвращает ключ (s3_key)"""
        extension = file.filename.split(".")[-1].lower()
        if extension not in ["epub", "fb2", "pdf"]:
            raise HTTPException(400, "Разрешены только EPUB, FB2, PDF")

        # Уникальное имя: user_123_abc123.epub
        s3_key = f"users/{user_id}/{uuid4()}.{extension}"

        try:
            # Загружаем напрямую из UploadFile (очень эффективно)
            await asyncio.to_thread(
                self.s3_client.upload_fileobj,
                file.file,
                self.bucket,
                s3_key,
                ExtraArgs={"ContentType": file.content_type or "application/octet-stream"}
            )
            return s3_key
        except Exception as e:
            raise HTTPException(500, f"Ошибка загрузки в хранилище: {str(e)}")

    async def get_presigned_url(self, s3_key: str) -> str:
        """Генерирует временную ссылку для скачивания/чтения (1 час)"""
        try:
            url = await asyncio.to_thread(
                self.s3_client.generate_presigned_url,
                "get_object",
                Params={"Bucket": self.bucket, "Key": s3_key},
                ExpiresIn=settings.PRESIGNED_URL_EXPIRE_MINUTES * 60,
            )
            return url
        except Exception:
            raise HTTPException(500, "Не удалось сгенерировать ссылку на книгу")


storage = StorageService()