"""
Serviço de gerenciamento seguro de credenciais dos fornecedores
Busca credenciais de variáveis de ambiente ou banco de dados
Nunca expõe senhas em logs ou retornos de API
"""
import os
import logging
from typing import Optional, Dict
from cryptography.fernet import Fernet
import base64

logger = logging.getLogger(__name__)


class CredentialsManager:
    """
    Gerenciador de credenciais dos fornecedores
    Suporta:
    - Variáveis de ambiente
    - Criptografia de senhas
    - Integração com CRUD de fornecedores
    """

    def __init__(self):
        # Chave de criptografia (deve estar em variável de ambiente)
        encryption_key = os.getenv("CREDENTIALS_ENCRYPTION_KEY")
        if encryption_key:
            self.cipher = Fernet(encryption_key.encode())
        else:
            # Gerar chave temporária se não configurada (apenas para desenvolvimento)
            logger.warning("CREDENTIALS_ENCRYPTION_KEY não configurada. Usando chave temporária.")
            self.cipher = Fernet(Fernet.generate_key())

    def get_credentials(self, supplier_id: str, supplier_name: str) -> Optional[Dict[str, str]]:
        """
        Busca credenciais para um fornecedor específico
        Ordem de prioridade:
        1. Banco de dados (via supplier_id)
        2. Variáveis de ambiente (via supplier_name)

        Args:
            supplier_id: ID do fornecedor no banco
            supplier_name: Nome do fornecedor

        Returns:
            Dict com 'username' e 'password' ou None
        """
        try:
            # 1. Tentar buscar do banco de dados (implementar quando tiver DB)
            # credentials = self._get_from_database(supplier_id)
            # if credentials:
            #     return credentials

            # 2. Buscar de variáveis de ambiente
            credentials = self._get_from_env(supplier_name)
            if credentials:
                return credentials

            logger.info(f"Nenhuma credencial encontrada para {supplier_name} (ID: {supplier_id})")
            return None

        except Exception as e:
            logger.error(f"Erro ao buscar credenciais para {supplier_name}: {e}")
            return None

    def _get_from_env(self, supplier_name: str) -> Optional[Dict[str, str]]:
        """
        Busca credenciais de variáveis de ambiente
        Formato esperado:
        SUPPLIER_{NOME}_USERNAME=usuario
        SUPPLIER_{NOME}_PASSWORD=senha
        """
        # Normalizar nome para formato de variável de ambiente
        env_name = supplier_name.upper().replace(" ", "_").replace("-", "_")

        username = os.getenv(f"SUPPLIER_{env_name}_USERNAME")
        password = os.getenv(f"SUPPLIER_{env_name}_PASSWORD")

        if username and password:
            logger.info(f"Credenciais encontradas em variáveis de ambiente para {supplier_name}")
            return {
                "username": username,
                "password": password
            }

        return None

    def encrypt_password(self, password: str) -> str:
        """
        Criptografa uma senha para armazenamento seguro

        Args:
            password: Senha em texto plano

        Returns:
            Senha criptografada em base64
        """
        try:
            encrypted = self.cipher.encrypt(password.encode())
            return base64.b64encode(encrypted).decode()
        except Exception as e:
            logger.error(f"Erro ao criptografar senha: {e}")
            raise

    def decrypt_password(self, encrypted_password: str) -> str:
        """
        Descriptografa uma senha armazenada

        Args:
            encrypted_password: Senha criptografada em base64

        Returns:
            Senha em texto plano
        """
        try:
            encrypted = base64.b64decode(encrypted_password.encode())
            decrypted = self.cipher.decrypt(encrypted)
            return decrypted.decode()
        except Exception as e:
            logger.error(f"Erro ao descriptografar senha: {e}")
            raise

    def validate_credentials(self, username: str, password: str) -> bool:
        """
        Valida se credenciais estão no formato correto

        Args:
            username: Nome de usuário
            password: Senha

        Returns:
            True se válido, False caso contrário
        """
        if not username or not password:
            return False

        if len(username) < 3:
            logger.warning("Username muito curto")
            return False

        if len(password) < 4:
            logger.warning("Password muito curto")
            return False

        return True

    def sanitize_for_logging(self, credentials: Dict[str, str]) -> Dict[str, str]:
        """
        Remove informações sensíveis para logging seguro

        Args:
            credentials: Dict com credenciais

        Returns:
            Dict com senha mascarada
        """
        if not credentials:
            return {}

        return {
            "username": credentials.get("username", ""),
            "password": "***HIDDEN***"
        }


# Singleton global
_credentials_manager = None


def get_credentials_manager() -> CredentialsManager:
    """
    Retorna instância singleton do gerenciador de credenciais
    """
    global _credentials_manager
    if _credentials_manager is None:
        _credentials_manager = CredentialsManager()
    return _credentials_manager
