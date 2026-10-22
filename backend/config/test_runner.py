from django.test.runner import DiscoverRunner
from django.apps import apps
from django.db import connection

class ManagedModelTestRunner(DiscoverRunner):
    """
    Test runner that creates tables for unmanaged models in SQLite test db.
    """
    def setup_databases(self, **kwargs):
        # Find unmanaged models
        unmanaged = [m for m in apps.get_models() if not m._meta.managed]

        old_config = super().setup_databases(**kwargs)

        with connection.cursor() as cursor:
            tables = connection.introspection.table_names(cursor)

        with connection.schema_editor() as schema_editor:
            for m in unmanaged:
                if m._meta.db_table not in tables:
                    try:
                        schema_editor.create_model(m)
                    except Exception:
                        pass

        return old_config
