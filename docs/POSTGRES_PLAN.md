# Kế hoạch hỗ trợ PostgreSQL cho andb-core

## Mục tiêu

Nâng cấp `andb-core` để hỗ trợ so sánh và migration cho cơ sở dữ liệu PostgreSQL, bên cạnh MySQL hiện có. Việc này đòi hỏi tái cấu trúc mã nguồn hiện tại (đang bị couple chặt với MySQL) sang kiến trúc Driver dạng module hóa, co strategy.

## Phân tích hiện trạng

- **Phụ thuộc trực tiếp vào `mysql2`**: `MigratorService` và `ComparatorService` đang gọi trực tiếp thư viện `mysql2`.
- **SQL đặc thù MySQL**: Sử dụng các lệnh như `SHOW CREATE TABLE`, dùng backticks (\`) để escape tên, và cú pháp định nghĩa bảng đặc thù của MySQL.
- **Parsing đặc thù MySQL**: `ComparatorService` sử dụng Regex được viết riêng cho output của MySQL.

## Kiến trúc mới

### 1. Database Driver Abstraction

Tạo interface `IDatabaseDriver` định nghĩa các hành vi chung:

- `connect(config)`: Thiết lập kết nối.
- `query(sql, params)`: Thực thi query thuần.
- `beginTransaction()`, `commit()`, `rollback()`: Quản lý transaction.
- `fetchDDL(type, name)`: Lấy định nghĩa DDL của object (Table, View, Func...).
- `introspection`: Các hàm để lấy danh sách bảng, view, function từ DB.

### 2. DDL Parser/Generator Abstraction

Tạo interface `IDDLHandler`:

- `parseTable(ddl)`: Chuyển đổi DDL string thành JSON object tiêu chuẩn (không phụ thuộc DB).
- `generateAlter(srcDef, destDef)`: Tạo câu lệnh ALTER TABLE dựa trên khác biệt.
- `normalize(ddl)`: Chuẩn hóa DDL để so sánh (loại bỏ các khác biệt nhỏ về format).

### 3. Service Layer Refactoring

Cập nhật `MigratorService` và `ComparatorService`:

- Không khởi tạo `mysql2` trực tiếp. Nhận `Driver` từ Factory hoặc Container.
- Gọi `driver.fetchDDL()` thay vì tự chạy query `SHOW CREATE...`.
- Gọi `driver.ddlHandler.parseTable()` thay vì dùng regex hardcode.

## Các bước thực hiện (Implementation Plan)

### Giai đoạn 1: Chuẩn bị & Interface

- [ ] Tạo file `core/interfaces/driver.interface.js`.
- [ ] Định nghĩa `StandardTableDefinition` (cấu trúc JSON đại diện cho Table).
- [ ] Tạo thư mục `core/drivers`.

### Giai đoạn 2: Refactor MySQL Driver

- [ ] Tạo `core/drivers/mysql/index.js` implement `IDatabaseDriver`.
- [ ] Tạo `core/drivers/mysql/ddl-handler.js` implement `IDDLHandler`.
- [ ] Di chuyển logic query từ `MigratorService` vào `MySQLDriver`.
- [ ] Di chuyển logic regex parsing từ `ComparatorService` vào `MySQLDriver` (DDL Handler).
- [ ] **Kiểm thử**: Đảm bảo toàn bộ test case hiện tại của MySQL vẫn chạy đúng (Regression Test).

### Giai đoạn 3: Implement PostgreSQL Driver

- [ ] Cài đặt gói `pg`.
- [ ] Tạo `core/drivers/postgres/index.js`.
- [ ] Implement query lấy DDL:
  - PostgreSQL không có lệnh `SHOW CREATE TABLE` đơn giản như MySQL. Sẽ cần query hệ thống (`pg_class`, `pg_attribute`, `information_schema`) hoặc dùng `pg_dump` logic để tái tạo DDL.
- [ ] Implement `PostgresDDLHandler`:
  - Parse cú pháp `CREATE TABLE` của Postgres.
  - Xử lý sự khác biệt về Data Type (e.g., `VARCHAR` vs `CHARACTER VARYING`).
  - Xử lý escaping (dùng `"` thay vì \`).

### Giai đoạn 4: Cập nhật Config & Core

- [ ] Cập nhật file config để có trường `type`: `'mysql' | 'postgres'`.
- [ ] Cập nhật `core/service/container.js` để load đúng driver dựa trên config.
- [ ] Cập nhật `constants.js` nếu cần thêm các object type mới (ví dụ `SEQUENCE`, `MATERIALIZED VIEW`).

### Giai đoạn 5: Testing

- [ ] Viết Unit Test cho `PostgresDriver`.
- [ ] Test thực tế chức năng Compare (Postgres vs Postgres).
- [ ] Test thực tế chức năng Migrate (Postgres vs Postgres).

## Chi tiết kỹ thuật cần lưu ý

### Sự khác biệt về DDL

| Feature  | MySQL               | PostgreSQL                        |
| -------- | ------------------- | --------------------------------- |
| Escaping | \`name\`            | "name"                            |
| Get DDL  | `SHOW CREATE TABLE` | Query System Catalogs / `pg_dump` |
| Auto Inc | `AUTO_INCREMENT`    | `SERIAL` / `SEQUENCE`             |
| Engine   | `ENGINE=InnoDB`     | (Storage method khác)             |

### Chiến lược so sánh (Comparison Strategy)

Ban đầu, sẽ ưu tiên hỗ trợ **Same-DB Comparison** (MySQL <> MySQL, PG <> PG). Comparison khác hệ (MySQL <> PG) phức tạp hơn nhiều do type mapping và sẽ nằm ở roadmap xa hơn.

---

_Created by Antigravity_
