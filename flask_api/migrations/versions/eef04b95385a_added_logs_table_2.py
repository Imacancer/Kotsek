"""Added Logs Table ^2

Revision ID: eef04b95385a
Revises: 29278ddb9996
Create Date: 2025-05-18 20:24:00.052505

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'eef04b95385a'
down_revision: Union[str, None] = '29278ddb9996'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('system_logs',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('timestamp', sa.DateTime(), nullable=False),
    sa.Column('log_type', sa.String(length=50), nullable=False),
    sa.Column('action', sa.String(length=255), nullable=False),
    sa.Column('details', sa.JSON(), nullable=True),
    sa.Column('user_id', sa.String(length=36), nullable=True),
    sa.Column('ip_address', sa.String(length=45), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['user_profiles.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
   
    op.drop_table('system_logs')
    # ### end Alembic commands ###
