from .settings import *

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

TEST_RUNNER = 'config.test_runner.ManagedModelTestRunner'
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
