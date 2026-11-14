-- Dữ liệu mẫu (không bắt buộc): 3 thợ mẫu + 3 dự án mẫu. Chạy bằng:  npm run db:seed
insert into workers (id,user_id,name,cat,city,rate,negot,exp,bio,skills,albums,cv,pub,busy_pub,created_at) values
(1,null,'Nguyễn Văn Hùng','Thợ điện','Hồ Chí Minh','600.000đ/công',false,12,'Chuyên thi công điện dân dụng, tủ điện công nghiệp, camera và điện năng lượng mặt trời.','["Tủ điện","Điện mặt trời","Camera"]','[{"id":"s1","title":"Ảnh công trình","place":"Hồ Chí Minh","year":"","role":"Tôi tự làm toàn bộ","desc":"","photos":[{"e":"⚡","note":"Tủ điện nhà xưởng"},{"e":"💡","note":"Điện chiếu sáng văn phòng"},{"e":"☀️","note":"Lắp pin mặt trời"}]}]','{}',false,false,0),
(2,null,'Trần Quốc Bảo','Thợ cơ khí','Đà Nẵng','550.000đ/công',false,9,'Hàn TIG/MIG, gia công inox, sửa chữa máy công nghiệp, bảo trì dây chuyền.','["Hàn TIG","Gia công inox","Bảo trì máy"]','[{"id":"s2","title":"Ảnh công trình","place":"Đà Nẵng","year":"","role":"Tôi tự làm toàn bộ","desc":"","photos":[{"e":"🔩","note":"Khung inox nhà hàng"},{"e":"🛠️","note":"Sửa hộp số"}]}]','{}',false,false,0),
(3,null,'Lê Thị Mai','Kỹ sư công trình','Hà Nội','1.200.000đ/công',false,8,'Giám sát thi công, bóc tách khối lượng, thiết kế kết cấu nhà dân và nhà xưởng.','["Giám sát","Bóc tách KL","Kết cấu"]','[{"id":"s3","title":"Ảnh công trình","place":"Hà Nội","year":"","role":"Tôi tự làm toàn bộ","desc":"","photos":[{"e":"🏗️","note":"Giám sát nhà 4 tầng"},{"e":"📐","note":"Bản vẽ kết cấu"}]}]','{}',false,false,0);
insert into reviews (worker_id,author_name,stars,body,at) values
(1,'Công ty An Phát',5,'Làm nhanh, đi dây gọn gàng, nghiệm thu đúng hẹn.',1791763200000),
(1,'Chị Lan',4,'Thợ nhiệt tình, giá hợp lý.',1790553600000),
(2,'Xưởng Minh Phúc',5,'Mối hàn đẹp, chắc chắn. Sẽ thuê lại.',1791158400000),
(3,'Anh Dũng',5,'Chuyên nghiệp, báo cáo rõ ràng từng hạng mục.',1792454400000);
insert into jobs (id,owner_id,owner_name,title,cat,city,budget,days,descr,created_at) values
(1,null,'Công ty Hưng Thịnh','Đi dây điện xưởng 300m²','Thợ điện','Hồ Chí Minh','600.000đ/công','10 công','Thi công điện 3 pha, lắp tủ phân phối, cần xong trong 2 tuần.',0),
(2,null,'Anh Khoa','Hàn khung thép mái che 60m²','Thợ cơ khí','Đà Nẵng','550.000đ/công','6 công','Có sẵn bản vẽ, vật tư chủ nhà lo.',0),
(3,null,'Chị Hà','Giám sát thi công nhà phố 3 tầng','Kỹ sư công trình','Hà Nội','1.000.000đ/công','40 công','Giám sát 4 tháng, báo cáo hàng tuần.',0);